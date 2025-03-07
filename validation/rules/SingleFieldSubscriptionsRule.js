"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingleFieldSubscriptionsRule = SingleFieldSubscriptionsRule;
const GraphQLError_js_1 = require("../../error/GraphQLError.js");
const kinds_js_1 = require("../../language/kinds.js");
const collectFields_js_1 = require("../../execution/collectFields.js");
function toNodes(fieldDetailsList) {
    return fieldDetailsList.map((fieldDetails) => fieldDetails.node);
}
/**
 * Subscriptions must only include a non-introspection field.
 *
 * A GraphQL subscription is valid only if it contains a single root field and
 * that root field is not an introspection field. `@skip` and `@include`
 * directives are forbidden.
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
                            fragments[definition.name.value] = { definition };
                        }
                    }
                    const { groupedFieldSet, forbiddenDirectiveInstances } = (0, collectFields_js_1.collectFields)(schema, fragments, variableValues, subscriptionType, node.selectionSet, context.hideSuggestions, true);
                    if (forbiddenDirectiveInstances.length > 0) {
                        context.reportError(new GraphQLError_js_1.GraphQLError(operationName != null
                            ? `Subscription "${operationName}" must not use \`@skip\` or \`@include\` directives in the top level selection.`
                            : 'Anonymous Subscription must not use `@skip` or `@include` directives in the top level selection.', { nodes: forbiddenDirectiveInstances }));
                        return;
                    }
                    if (groupedFieldSet.size > 1) {
                        const fieldDetailsLists = [...groupedFieldSet.values()];
                        const extraFieldDetailsLists = fieldDetailsLists.slice(1);
                        const extraFieldSelections = extraFieldDetailsLists.flatMap((fieldDetailsList) => toNodes(fieldDetailsList));
                        context.reportError(new GraphQLError_js_1.GraphQLError(operationName != null
                            ? `Subscription "${operationName}" must select only one top level field.`
                            : 'Anonymous Subscription must select only one top level field.', { nodes: extraFieldSelections }));
                    }
                    for (const fieldDetailsList of groupedFieldSet.values()) {
                        const fieldName = toNodes(fieldDetailsList)[0].name.value;
                        if (fieldName.startsWith('__')) {
                            context.reportError(new GraphQLError_js_1.GraphQLError(operationName != null
                                ? `Subscription "${operationName}" must not select an introspection top level field.`
                                : 'Anonymous Subscription must not select an introspection top level field.', { nodes: toNodes(fieldDetailsList) }));
                        }
                    }
                }
            }
        },
    };
}
//# sourceMappingURL=SingleFieldSubscriptionsRule.js.map