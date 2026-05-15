/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ASTVisitor } from '../../language/visitor.ts';

import type { ValidationContext } from '../ValidationContext.ts';

/**
 * No undefined variables
 *
 * A GraphQL operation is only valid if all variables encountered, both directly
 * and via fragment spreads, are defined by that operation.
 *
 * See https://spec.graphql.org/draft/#sec-All-Variable-Uses-Defined
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { NoUndefinedVariablesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     field(arg: ID): String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   query ($id: ID) { field(arg: $missing) }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [NoUndefinedVariablesRule]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   query ($id: ID) { field(arg: $id) }
 * `);
 * const validErrors = validate(schema, validDocument, [NoUndefinedVariablesRule]);
 *
 * validErrors; // => []
 * ```
 */
export function NoUndefinedVariablesRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    OperationDefinition(operation) {
      const variableNameDefined = new Set<string>(
        operation.variableDefinitions?.map((node) => node.variable.name.value),
      );

      const usages = context.getRecursiveVariableUsages(operation);
      for (const { node, fragmentVariableDefinition } of usages) {
        if (fragmentVariableDefinition) {
          continue;
        }
        const varName = node.name.value;
        if (!variableNameDefined.has(varName)) {
          context.reportError(
            new GraphQLError(
              operation.name
                ? `Variable "$${varName}" is not defined by operation "${operation.name.value}".`
                : `Variable "$${varName}" is not defined.`,
              { nodes: [node, operation] },
            ),
          );
        }
      }
    },
  };
}
