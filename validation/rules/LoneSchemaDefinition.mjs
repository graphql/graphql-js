import { GraphQLError } from "../../error/GraphQLError.mjs";

/**
 * Lone Schema definition
 *
 * A GraphQL document is only valid if it contains only one schema definition.
 */
export function LoneSchemaDefinition(context) {
  var oldSchema = context.getSchema();
  var alreadyDefined = (oldSchema === null || oldSchema === void 0 ? void 0 : oldSchema.astNode) || (oldSchema === null || oldSchema === void 0 ? void 0 : oldSchema.getQueryType()) || (oldSchema === null || oldSchema === void 0 ? void 0 : oldSchema.getMutationType()) || (oldSchema === null || oldSchema === void 0 ? void 0 : oldSchema.getSubscriptionType());
  var schemaDefinitionsCount = 0;
  return {
    SchemaDefinition: function SchemaDefinition(node) {
      if (alreadyDefined) {
        context.reportError(new GraphQLError('Cannot define a new schema within a schema extension.', node));
        return;
      }

      if (schemaDefinitionsCount > 0) {
        context.reportError(new GraphQLError('Must provide only one schema definition.', node));
      }

      ++schemaDefinitionsCount;
    }
  };
}
