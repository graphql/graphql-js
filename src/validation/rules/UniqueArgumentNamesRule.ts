/** @category Validation Rules */

import { groupBy } from '../../jsutils/groupBy.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ArgumentNode } from '../../language/ast.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import type { ASTValidationContext } from '../ValidationContext.ts';

/**
 * Unique argument names
 *
 * A GraphQL field or directive is only valid if all supplied arguments are
 * uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Argument-Names
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { UniqueArgumentNamesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     field(arg: String): String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { field(arg: "1", arg: "2") }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [UniqueArgumentNamesRule]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { field(arg: "1") }
 * `);
 * const validErrors = validate(schema, validDocument, [UniqueArgumentNamesRule]);
 *
 * validErrors; // => []
 * ```
 */
export function UniqueArgumentNamesRule(
  context: ASTValidationContext,
): ASTVisitor {
  return {
    Field: checkArgUniqueness,
    Directive: checkArgUniqueness,
  };

  function checkArgUniqueness(parentNode: {
    arguments?: ReadonlyArray<ArgumentNode> | undefined;
  }) {
    const argumentNodes = parentNode.arguments ?? [];

    const seenArgs = groupBy(argumentNodes, (arg) => arg.name.value);

    for (const [argName, argNodes] of seenArgs) {
      if (argNodes.length > 1) {
        context.reportError(
          new GraphQLError(
            `There can be only one argument named "${argName}".`,
            { nodes: argNodes.map((node) => node.name) },
          ),
        );
      }
    }
  }
}
