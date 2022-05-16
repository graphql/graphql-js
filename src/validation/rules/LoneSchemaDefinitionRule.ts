import type { ASTVisitor } from '../../language/visitor';

import type { SDLValidationContext } from '../ValidationContext';

/**
 * Lone Schema definition
 *
 * A GraphQL document is only valid if it contains only one schema definition.
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
        context.report({
          message: 'Cannot define a new schema within a schema extension.',
          nodes: node,
        });
        return;
      }

      if (schemaDefinitionsCount > 0) {
        context.report({
          message: 'Must provide only one schema definition.',
          nodes: node,
        });
      }
      ++schemaDefinitionsCount;
    },
  };
}
