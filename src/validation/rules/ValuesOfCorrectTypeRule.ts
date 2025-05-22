import type { Maybe } from '../../jsutils/Maybe.js';

import type { ValueNode } from '../../language/ast.js';
import type { ASTVisitor } from '../../language/visitor.js';

import type { GraphQLInputType } from '../../type/index.js';

import { validateInputLiteral } from '../../utilities/validateInputValue.js';

import type { ValidationContext } from '../ValidationContext.js';

/**
 * Value literals of correct type
 *
 * A GraphQL document is only valid if all value literals are of the type
 * expected at their position.
 *
 * See https://spec.graphql.org/draft/#sec-Values-of-Correct-Type
 */
export function ValuesOfCorrectTypeRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    NullValue: (node) =>
      isValidValueNode(context, node, context.getInputType()),
    ListValue: (node) =>
      // Note: TypeInfo will traverse into a list's item type, so look to the
      // parent input type to check if it is a list.
      isValidValueNode(context, node, context.getParentInputType()),
    ObjectValue: (node) =>
      isValidValueNode(context, node, context.getInputType()),
    EnumValue: (node) =>
      isValidValueNode(context, node, context.getInputType()),
    IntValue: (node) => isValidValueNode(context, node, context.getInputType()),
    FloatValue: (node) =>
      isValidValueNode(context, node, context.getInputType()),
    StringValue: (node) =>
      isValidValueNode(context, node, context.getInputType()),
    BooleanValue: (node) =>
      isValidValueNode(context, node, context.getInputType()),
  };
}

/**
 * Any value literal may be a valid representation of a Scalar, depending on
 * that scalar type.
 */
function isValidValueNode(
  context: ValidationContext,
  node: ValueNode,
  inputType: Maybe<GraphQLInputType>,
): false {
  if (inputType) {
    validateInputLiteral(
      node,
      inputType,
      (error) => {
        context.reportError(error);
      },
      undefined,
      undefined,
      context.hideSuggestions,
    );
  }
  return false;
}
