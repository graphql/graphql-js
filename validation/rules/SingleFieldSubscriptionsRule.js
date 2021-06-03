'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.SingleFieldSubscriptionsRule = SingleFieldSubscriptionsRule;

var _GraphQLError = require('../../error/GraphQLError.js');

var _kinds = require('../../language/kinds.js');

var _execute = require('../../execution/execute.js');

/**
 * Subscriptions must only include a non-introspection field.
 *
 * A GraphQL subscription is valid only if it contains a single root field and
 * that root field is not an introspection field.
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
            if (definition.kind === _kinds.Kind.FRAGMENT_DEFINITION) {
              fragments[definition.name.value] = definition;
            }
          } // FIXME: refactor out `collectFields` into utility function that doesn't need fake context.

          const fakeExecutionContext = {
            schema,
            fragments,
            rootValue: undefined,
            contextValue: undefined,
            operation: node,
            variableValues,
            fieldResolver: _execute.defaultFieldResolver,
            typeResolver: _execute.defaultTypeResolver,
            errors: [],
          };
          const fields = (0, _execute.collectFields)(
            fakeExecutionContext,
            subscriptionType,
            node.selectionSet,
            new Map(),
            new Set(),
          );

          if (fields.size > 1) {
            const fieldSelectionLists = [...fields.values()];
            const extraFieldSelectionLists = fieldSelectionLists.slice(1);
            const extraFieldSelections = extraFieldSelectionLists.flat();
            context.reportError(
              new _GraphQLError.GraphQLError(
                operationName != null
                  ? `Subscription "${operationName}" must select only one top level field.`
                  : 'Anonymous Subscription must select only one top level field.',
                extraFieldSelections,
              ),
            );
          }

          for (const fieldNodes of fields.values()) {
            const field = fieldNodes[0];
            const fieldName = field.name.value;

            if (fieldName[0] === '_' && fieldName[1] === '_') {
              context.reportError(
                new _GraphQLError.GraphQLError(
                  operationName != null
                    ? `Subscription "${operationName}" must not select an introspection top level field.`
                    : 'Anonymous Subscription must not select an introspection top level field.',
                  fieldNodes,
                ),
              );
            }
          }
        }
      }
    },
  };
}