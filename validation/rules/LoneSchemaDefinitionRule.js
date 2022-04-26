'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.LoneSchemaDefinitionRule = LoneSchemaDefinitionRule;

var _GraphQLError = require('../../error/GraphQLError.js');

/**
 * Lone Schema definition
 *
 * A GraphQL document is only valid if it contains only one schema definition.
 */
function LoneSchemaDefinitionRule(context) {
  const oldSchema = context.getSchema();
  const alreadyDefined =
    (oldSchema === null || oldSchema === void 0 ? void 0 : oldSchema.astNode) ??
    (oldSchema === null || oldSchema === void 0
      ? void 0
      : oldSchema.getQueryType()) ??
    (oldSchema === null || oldSchema === void 0
      ? void 0
      : oldSchema.getMutationType()) ??
    (oldSchema === null || oldSchema === void 0
      ? void 0
      : oldSchema.getSubscriptionType());
  let schemaDefinitionsCount = 0;
  return {
    SchemaDefinition(node) {
      if (alreadyDefined) {
        context.reportError(
          new _GraphQLError.GraphQLError(
            'Cannot define a new schema within a schema extension.',
            {
              nodes: node,
            },
          ),
        );
        return;
      }

      if (schemaDefinitionsCount > 0) {
        context.reportError(
          new _GraphQLError.GraphQLError(
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
