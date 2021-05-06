import { keyMap } from '../../jsutils/keyMap';
import { didYouMean } from '../../jsutils/didYouMean';
import { suggestionList } from '../../jsutils/suggestionList';

import { GraphQLError } from '../../error/GraphQLError';

import type { ValueNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';
import { print } from '../../language/printer';

import {
  isLeafType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isRequiredInputField,
  getNullableType,
  getNamedType,
} from '../../type/definition';

import type { ValidationContext } from '../ValidationContext';
import { replaceVariables } from '../../utilities/replaceVariables';

/**
 * Value literals of correct type
 *
 * A GraphQL document is only valid if all value literals are of the type
 * expected at their position.
 */
export function ValuesOfCorrectTypeRule(
  context: ValidationContext,
): ASTVisitor {
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
      const fieldNodeMap = keyMap(node.fields, (field) => field.name.value);
      for (const fieldDef of Object.values(type.getFields())) {
        const fieldNode = fieldNodeMap[fieldDef.name];
        if (!fieldNode && isRequiredInputField(fieldDef)) {
          context.reportError(
            new GraphQLError(
              `Field "${fieldDef}" of required type "${fieldDef.type}" was not provided.`,
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
            `Field "${node.name.value}" is not defined by type "${parentType}".` +
              didYouMean(suggestions),
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
            `Expected value of type "${type}", found ${print(node)}.`,
            node,
          ),
        );
      }
    },
    EnumValue: (node) => isValidValueNode(context, node),
    IntValue: (node) => isValidValueNode(context, node),
    FloatValue: (node) => isValidValueNode(context, node),
    StringValue: (node) => isValidValueNode(context, node),
    BooleanValue: (node) => isValidValueNode(context, node),
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

  if (!isLeafType(type)) {
    context.reportError(
      new GraphQLError(
        `Expected value of type "${locationType}", found ${print(node)}.`,
        node,
      ),
    );
    return;
  }

  const constValueNode = replaceVariables(node);

  // Scalars and Enums determine if a literal value is valid via parseLiteral(),
  // which may throw or return undefined to indicate an invalid value.
  try {
    const parseResult = type.parseLiteral(constValueNode);
    if (parseResult === undefined) {
      context.reportError(
        new GraphQLError(
          `Expected value of type "${locationType}", found ${print(node)}.`,
          node,
        ),
      );
    }
  } catch (error) {
    if (error instanceof GraphQLError) {
      context.reportError(error);
    } else {
      context.reportError(
        new GraphQLError(
          `Expected value of type "${locationType}", found ${print(node)}; ` +
            error.message,
          node,
          undefined,
          undefined,
          undefined,
          error, // Ensure a reference to the original error is maintained.
        ),
      );
    }
  }
}
