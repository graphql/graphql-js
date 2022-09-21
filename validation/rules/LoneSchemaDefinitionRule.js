'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.LoneSchemaDefinitionRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
/**
 * Lone Schema definition
 *
 * A GraphQL document is only valid if it contains only one schema definition.
 */
function LoneSchemaDefinitionRule(context) {
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
          new GraphQLError_js_1.GraphQLError(
            'Cannot define a new schema within a schema extension.',
            { nodes: node },
          ),
        );
        return;
      }
      if (schemaDefinitionsCount > 0) {
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            'Must provide only one schema definition.',
            {
              nodes: node,
            },
          ),
        );
      }
      ++schemaDefinitionsCount;
    },
  };
}
exports.LoneSchemaDefinitionRule = LoneSchemaDefinitionRule;
