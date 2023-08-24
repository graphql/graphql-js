'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SingleFieldSubscriptionsRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const kinds_js_1 = require('../../language/kinds.js');
const collectFields_js_1 = require('../../execution/collectFields.js');
function toNodes(fieldGroup) {
  return fieldGroup.fields.map((fieldDetails) => fieldDetails.node);
}
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
          const { groupedFieldSet } = (0, collectFields_js_1.collectFields)(
            schema,
            fragments,
            variableValues,
            subscriptionType,
            node,
          );
          if (groupedFieldSet.size > 1) {
            const fieldGroups = [...groupedFieldSet.values()];
            const extraFieldGroups = fieldGroups.slice(1);
            const extraFieldSelections = extraFieldGroups.flatMap(
              (fieldGroup) => toNodes(fieldGroup),
            );
            context.reportError(
              new GraphQLError_js_1.GraphQLError(
                operationName != null
                  ? `Subscription "${operationName}" must select only one top level field.`
                  : 'Anonymous Subscription must select only one top level field.',
                { nodes: extraFieldSelections },
              ),
            );
          }
          for (const fieldGroup of groupedFieldSet.values()) {
            const fieldName = toNodes(fieldGroup)[0].name.value;
            if (fieldName.startsWith('__')) {
              context.reportError(
                new GraphQLError_js_1.GraphQLError(
                  operationName != null
                    ? `Subscription "${operationName}" must not select an introspection top level field.`
                    : 'Anonymous Subscription must not select an introspection top level field.',
                  { nodes: toNodes(fieldGroup) },
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
