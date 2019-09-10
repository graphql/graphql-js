// @flow strict

import objectValues from '../../polyfills/objectValues';

import keyMap from '../../jsutils/keyMap';
import inspect from '../../jsutils/inspect';
import isInvalid from '../../jsutils/isInvalid';
import didYouMean from '../../jsutils/didYouMean';
import suggestionList from '../../jsutils/suggestionList';

import { GraphQLError } from '../../error/GraphQLError';

import { Kind } from '../../language/kinds';
import { print } from '../../language/printer';
import { type ValueNode } from '../../language/ast';
import { type ASTVisitor } from '../../language/visitor';

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

import { type ValidationContext } from '../ValidationContext';

/**
 * Value literals of correct type
 *
 * A GraphQL document is only valid if all value literals are of the type
 * expected at their position.
 */
export function ValuesOfCorrectType(context: ValidationContext): ASTVisitor {
  return {
    ListValue(node) {
      // Note: TypeInfo will traverse into a list's item type, so look to the
      // parent input type to check if it is a list.
      const type = getNullableType(context.getParentInputType());
      if (!isListType(type)) {
        isValidValueNode(context, node);
        return false; // Don't traverse further.
      }
    },
    ObjectValue(node) {
      const type = getNamedType(context.getInputType());
      if (!isInputObjectType(type)) {
        isValidValueNode(context, node);
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
              `Field "${type.name}.${fieldDef.name}" of required type "${typeStr}" was not provided.`,
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
        context.reportError(
          new GraphQLError(
            `Field "${node.name.value}" is not defined by type "${parentType.name}".` +
              didYouMean(suggestions.map(name => '"' + name + '"')),
            node,
          ),
        );
      }
    },
    NullValue(node) {
      const type = context.getInputType();
      if (isNonNullType(type)) {
        context.reportError(
          new GraphQLError(
            `Expected value of type "${inspect(type)}", found ${print(node)}.`,
            node,
          ),
        );
      }
    },
    EnumValue: node => isValidValueNode(context, node),
    IntValue: node => isValidValueNode(context, node),
    FloatValue: node => isValidValueNode(context, node),
    StringValue: node => isValidValueNode(context, node),
    BooleanValue: node => isValidValueNode(context, node),
  };
}

/**
 * Any value literal may be a valid representation of a Scalar, depending on
 * that scalar type.
 */
function isValidValueNode(context: ValidationContext, node: ValueNode): void {
  // Report any error at the full type expected by the location.
  const locationType = context.getInputType();
  if (!locationType) {
    return;
  }

  const type = getNamedType(locationType);

  if (isEnumType(type)) {
    if (node.kind !== Kind.ENUM || !type.getValue(node.value)) {
      const allNames = type.getValues().map(value => value.name);
      const suggestedValues = suggestionList(print(node), allNames).map(
        x => '"' + x + '"',
      );

      context.reportError(
        new GraphQLError(
          `Expected value of type "${type.name}", found ${print(node)}.` +
            didYouMean('the enum value', suggestedValues),
          node,
        ),
      );
    }
    return;
  }

  if (!isScalarType(type)) {
    const typeStr = inspect(locationType);
    context.reportError(
      new GraphQLError(
        `Expected value of type "${typeStr}", found ${print(node)}.`,
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
      const typeStr = inspect(locationType);
      context.reportError(
        new GraphQLError(
          `Expected value of type "${typeStr}", found ${print(node)}.`,
          node,
        ),
      );
    }
  } catch (error) {
    const typeStr = inspect(locationType);
    // Ensure a reference to the original error is maintained.
    context.reportError(
      new GraphQLError(
        `Expected value of type "${typeStr}", found ${print(node)}; ` +
          error.message,
        node,
        undefined,
        undefined,
        undefined,
        error,
      ),
    );
  }
}
