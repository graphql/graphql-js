/** @category Validation Rules */

import type { Maybe } from '../../jsutils/Maybe.ts';

import type { ValueNode } from '../../language/ast.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import type { GraphQLInputType } from '../../type/index.ts';

import { validateInputLiteral } from '../../utilities/validateInputValue.ts';

import type { ValidationContext } from '../ValidationContext.ts';

/**
 * Value literals of correct type
 *
 * A GraphQL document is only valid if all value literals are of the type
 * expected at their position.
 *
 * See https://spec.graphql.org/draft/#sec-Values-of-Correct-Type
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { ValuesOfCorrectTypeRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     count(limit: Int): Int
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { count(limit: "many") }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [ValuesOfCorrectTypeRule]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { count(limit: 1) }
 * `);
 * const validErrors = validate(schema, validDocument, [ValuesOfCorrectTypeRule]);
 *
 * validErrors; // => []
 * ```
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
    // Descriptions are string values that would not validate according
    // to the below logic, but since (per the specification) descriptions must
    // not affect validation, they are ignored entirely when visiting the AST
    // and do not require special handling.
    // See https://spec.graphql.org/draft/#sec-Descriptions
    StringValue: (node) =>
      isValidValueNode(context, node, context.getInputType()),
    BooleanValue: (node) =>
      isValidValueNode(context, node, context.getInputType()),
  };
}

/**
 * Any value literal may be a valid representation of a Scalar, depending on
 * that scalar type.
 *
 * @internal
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
