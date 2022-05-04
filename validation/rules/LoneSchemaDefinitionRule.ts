import { GraphQLError } from '../../error/GraphQLError.ts';
import type { ASTVisitor } from '../../language/visitor.ts';
import type { SDLValidationContext } from '../ValidationContext.ts';
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
