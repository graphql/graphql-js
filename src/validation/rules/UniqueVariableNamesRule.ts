/** @category Validation Rules */

import { groupBy } from '../../jsutils/groupBy.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ASTVisitor } from '../../language/visitor.ts';

import type { ASTValidationContext } from '../ValidationContext.ts';

/**
 * Unique variable names
 *
 * A GraphQL operation is only valid if all its variables are uniquely named.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { UniqueVariableNamesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     field(arg: ID): String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   query ($id: ID, $id: ID) { field(arg: $id) }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [UniqueVariableNamesRule]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   query ($id: ID) { field(arg: $id) }
 * `);
 * const validErrors = validate(schema, validDocument, [UniqueVariableNamesRule]);
 *
 * validErrors; // => []
 * ```
 */
export function UniqueVariableNamesRule(
  context: ASTValidationContext,
): ASTVisitor {
  return {
    OperationDefinition(operationNode) {
      const variableDefinitions = operationNode.variableDefinitions ?? [];

      const seenVariableDefinitions = groupBy(
        variableDefinitions,
        (node) => node.variable.name.value,
      );

      for (const [variableName, variableNodes] of seenVariableDefinitions) {
        if (variableNodes.length > 1) {
          context.reportError(
            new GraphQLError(
              `There can be only one variable named "$${variableName}".`,
              { nodes: variableNodes.map((node) => node.variable.name) },
            ),
          );
        }
      }
    },
  };
}
