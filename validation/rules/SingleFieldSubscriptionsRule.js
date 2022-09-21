'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SingleFieldSubscriptionsRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const kinds_js_1 = require('../../language/kinds.js');
const collectFields_js_1 = require('../../execution/collectFields.js');
/**
 * Subscriptions must only include a non-introspection field.
 *
 * A GraphQL subscription is valid only if it contains a single root field and
 * that root field is not an introspection field.
 *
 * See https://spec.graphql.org/draft/#sec-Single-root-field
 */
function SingleFieldSubscriptionsRule(context) {
  return {
    OperationDefinition(node) {
      if (node.operation === 'subscription') {
        const schema = context.getSchema();
        const subscriptionType = schema.getSubscriptionType();
        if (subscriptionType) {
          const operationName = node.name ? node.name.value : null;
          const variableValues = Object.create(null);
          const document = context.getDocument();
          const fragments = Object.create(null);
          for (const definition of document.definitions) {
            if (definition.kind === kinds_js_1.Kind.FRAGMENT_DEFINITION) {
              fragments[definition.name.value] = definition;
            }
          }
          const { fields } = (0, collectFields_js_1.collectFields)(
            schema,
            fragments,
            variableValues,
            subscriptionType,
            node.selectionSet,
          );
          if (fields.size > 1) {
            const fieldSelectionLists = [...fields.values()];
            const extraFieldSelectionLists = fieldSelectionLists.slice(1);
            const extraFieldSelections = extraFieldSelectionLists.flat();
            context.reportError(
              new GraphQLError_js_1.GraphQLError(
                operationName != null
                  ? `Subscription "${operationName}" must select only one top level field.`
                  : 'Anonymous Subscription must select only one top level field.',
                { nodes: extraFieldSelections },
              ),
            );
          }
          for (const fieldNodes of fields.values()) {
            const fieldName = fieldNodes[0].name.value;
            if (fieldName.startsWith('__')) {
              context.reportError(
                new GraphQLError_js_1.GraphQLError(
                  operationName != null
                    ? `Subscription "${operationName}" must not select an introspection top level field.`
                    : 'Anonymous Subscription must not select an introspection top level field.',
                  { nodes: fieldNodes },
                ),
              );
            }
          }
        }
      }
    },
  };
}
exports.SingleFieldSubscriptionsRule = SingleFieldSubscriptionsRule;
