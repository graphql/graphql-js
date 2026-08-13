/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError';

import type { ASTVisitor } from '../../language/visitor';

import type { SDLValidationContext } from '../ValidationContext';

/**
 * Lone Schema definition
 *
 * A GraphQL document is only valid if it contains only one schema definition.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql';
 * import { LoneSchemaDefinitionRule } from 'graphql/validation';
 *
 * const invalidSDL = `
 *   schema { query: Query } schema { query: Query } type Query { name: String }
 * `;
 *
 * LoneSchemaDefinitionRule.name; // => 'LoneSchemaDefinitionRule'
 * buildSchema(invalidSDL); // throws an error
 *
 * const validSDL = `
 *   schema { query: Query } type Query { name: String }
 * `;
 *
 * buildSchema(validSDL); // does not throw
 * ```
 */
export function LoneSchemaDefinitionRule(
  context: SDLValidationContext,
): ASTVisitor {
  const oldSchema = context.getSchema();
  const alreadyDefined =
    oldSchema?.astNode ??
    oldSchema?.getQueryType() ??
    oldSchema?.getMutationType() ??
    oldSchema?.getSubscriptionType();

  let schemaDefinitionsCount = 0;
  return {
    SchemaDefinition(node) {
      if (alreadyDefined) {
        context.reportError(
          new GraphQLError(
            'Cannot define a new schema within a schema extension.',
            { nodes: node },
          ),
        );
        return;
      }

      if (schemaDefinitionsCount > 0) {
        context.reportError(
          new GraphQLError('Must provide only one schema definition.', {
            nodes: node,
          }),
        );
      }
      ++schemaDefinitionsCount;
    },
  };
}
