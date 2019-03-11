/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import objectValues from '../../polyfills/objectValues';
import type { ValidationContext } from '../ValidationContext';
import { GraphQLError } from '../../error/GraphQLError';
import type { ValueNode } from '../../language/ast';
import { print } from '../../language/printer';
import type { ASTVisitor } from '../../language/visitor';
import {
  isScalarType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isRequiredInputField,
  getNullableType,
  getNamedType,
} from '../../type/definition';
import type { GraphQLType } from '../../type/definition';
import inspect from '../../jsutils/inspect';
import isInvalid from '../../jsutils/isInvalid';
import keyMap from '../../jsutils/keyMap';
import orList from '../../jsutils/orList';
import suggestionList from '../../jsutils/suggestionList';

export function badValueMessage(
  typeName: string,
  valueName: string,
  message?: string,
): string {
  return (
    `Expected type ${typeName}, found ${valueName}` +
    (message ? `; ${message}` : '.')
  );
}

export function requiredFieldMessage(
  typeName: string,
  fieldName: string,
  fieldTypeName: string,
): string {
  return (
    `Field ${typeName}.${fieldName} of required type ` +
    `${fieldTypeName} was not provided.`
  );
}

export function unknownFieldMessage(
  typeName: string,
  fieldName: string,
  message?: string,
): string {
  return (
    `Field "${fieldName}" is not defined by type ${typeName}` +
    (message ? `; ${message}` : '.')
  );
}

/**
 * Value literals of correct type
 *
 * A GraphQL document is only valid if all value literals are of the type
 * expected at their position.
 */
export function ValuesOfCorrectType(context: ValidationContext): ASTVisitor {
  return {
    NullValue(node) {
      const type = context.getInputType();
      if (isNonNullType(type)) {
        context.reportError(
          new GraphQLError(badValueMessage(inspect(type), print(node)), node),
        );
      }
    },
    ListValue(node) {
      // Note: TypeInfo will traverse into a list's item type, so look to the
      // parent input type to check if it is a list.
      const type = getNullableType(context.getParentInputType());
      if (!isListType(type)) {
        isValidScalar(context, node);
        return false; // Don't traverse further.
      }
    },
    ObjectValue(node) {
      const type = getNamedType(context.getInputType());
      if (!isInputObjectType(type)) {
        isValidScalar(context, node);
        return false; // Don't traverse further.
      }
      // Ensure every required field exists.
      const fieldNodeMap = keyMap(node.fields, field => field.name.value);
      for (const fieldDef of objectValues(type.getFields())) {
        const fieldNode = fieldNodeMap[fieldDef.name];
        if (!fieldNode && isRequiredInputField(fieldDef)) {
          const typeStr = inspect(fieldDef.type);
          context.reportError(
            new GraphQLError(
              requiredFieldMessage(type.name, fieldDef.name, typeStr),
              node,
            ),
          );
        }
      }
    },
    ObjectField(node) {
      const parentType = getNamedType(context.getParentInputType());
      const fieldType = context.getInputType();
      if (!fieldType && isInputObjectType(parentType)) {
        const suggestions = suggestionList(
          node.name.value,
          Object.keys(parentType.getFields()),
        );
        const didYouMean =
          suggestions.length !== 0
            ? `Did you mean ${orList(suggestions)}?`
            : undefined;
        context.reportError(
          new GraphQLError(
            unknownFieldMessage(parentType.name, node.name.value, didYouMean),
            node,
          ),
        );
      }
    },
    EnumValue(node) {
      const type = getNamedType(context.getInputType());
      if (!isEnumType(type)) {
        isValidScalar(context, node);
      } else if (!type.getValue(node.value)) {
        context.reportError(
          new GraphQLError(
            badValueMessage(
              type.name,
              print(node),
              enumTypeSuggestion(type, node),
            ),
            node,
          ),
        );
      }
    },
    IntValue: node => isValidScalar(context, node),
    FloatValue: node => isValidScalar(context, node),
    StringValue: node => isValidScalar(context, node),
    BooleanValue: node => isValidScalar(context, node),
  };
}

/**
 * Any value literal may be a valid representation of a Scalar, depending on
 * that scalar type.
 */
function isValidScalar(context: ValidationContext, node: ValueNode): void {
  // Report any error at the full type expected by the location.
  const locationType = context.getInputType();
  if (!locationType) {
    return;
  }

  const type = getNamedType(locationType);

  if (!isScalarType(type)) {
    context.reportError(
      new GraphQLError(
        badValueMessage(
          inspect(locationType),
          print(node),
          enumTypeSuggestion(type, node),
        ),
        node,
      ),
    );
    return;
  }

  // Scalars determine if a literal value is valid via parseLiteral() which
  // may throw or return an invalid value to indicate failure.
  try {
    const parseResult = type.parseLiteral(node, undefined /* variables */);
    if (isInvalid(parseResult)) {
      context.reportError(
        new GraphQLError(
          badValueMessage(inspect(locationType), print(node)),
          node,
        ),
      );
    }
  } catch (error) {
    // Ensure a reference to the original error is maintained.
    context.reportError(
      new GraphQLError(
        badValueMessage(inspect(locationType), print(node), error.message),
        node,
        undefined,
        undefined,
        undefined,
        error,
      ),
    );
  }
}

function enumTypeSuggestion(type: GraphQLType, node: ValueNode): string | void {
  if (isEnumType(type)) {
    const suggestions = suggestionList(
      print(node),
      type.getValues().map(value => value.name),
    );
    if (suggestions.length !== 0) {
      return `Did you mean the enum value ${orList(suggestions)}?`;
    }
  }
}
