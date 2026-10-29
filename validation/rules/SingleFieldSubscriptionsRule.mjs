import { GraphQLError } from "../../error/GraphQLError.mjs";
import { Kind } from "../../language/kinds.mjs";
import { GraphQLDeferDirective } from "../../type/directives.mjs";
import { collectFields, visitSelectionSets as visitSelectionSetsImpl, } from "../../execution/collectFields.mjs";
function toNodes(fieldDetailsList) {
    return fieldDetailsList.map((fieldDetails) => fieldDetails.node);
}
export function SingleFieldSubscriptionsRule(context) {
    let fragments;
    const visitSelectionSets = (visitContext, selectionSet, groupedFieldSet, newDeferUsages, ...[deferUsage, fragmentVariableValues]) => {
        context.spendFragmentWork(selectionSet.selections.length);
        for (const selection of selectionSet.selections) {
            const directives = selection.directives;
            if (directives !== undefined) {
                context.spendFragmentWork(directives.length);
                const defer = directives.find((directive) => directive.name.value === GraphQLDeferDirective.name);
                context.spendFragmentWork(defer?.arguments?.length ?? 0);
            }
        }
        visitSelectionSetsImpl(visitContext, selectionSet, groupedFieldSet, newDeferUsages, deferUsage, fragmentVariableValues, visitSelectionSets);
    };
    return {
        OperationDefinition(node) {
            if (node.operation === 'subscription') {
                const schema = context.getSchema();
                const subscriptionType = schema.getSubscriptionType();
                if (subscriptionType) {
                    const operationName = node.name ? node.name.value : null;
                    const variableValues = {
                        sources: Object.create(null),
                        coerced: Object.create(null),
                    };
                    if (!fragments) {
                        fragments = Object.create(null);
                        for (const definition of context.getDocument().definitions) {
                            if (definition.kind === Kind.FRAGMENT_DEFINITION) {
                                fragments[definition.name.value] = { definition };
                            }
                        }
                    }
                    const { groupedFieldSet, forbiddenDirectiveInstances } = collectFields(schema, fragments, variableValues, subscriptionType, node.selectionSet, context.hideSuggestions, true, visitSelectionSets);
                    if (forbiddenDirectiveInstances.length > 0) {
                        context.reportError(new GraphQLError(operationName != null
                            ? `Subscription "${operationName}" must not use \`@skip\` or \`@include\` directives in the top level selection.`
                            : 'Anonymous Subscription must not use `@skip` or `@include` directives in the top level selection.', { nodes: forbiddenDirectiveInstances }));
                        return;
                    }
                    if (groupedFieldSet.size === 0) {
                        context.reportError(new GraphQLError(operationName != null
                            ? `Subscription "${operationName}" must select one top level field.`
                            : 'Anonymous Subscription must select one top level field.', { nodes: node.selectionSet }));
                    }
                    else if (groupedFieldSet.size > 1) {
                        const fieldDetailsLists = [...groupedFieldSet.values()];
                        const extraFieldDetailsLists = fieldDetailsLists.slice(1);
                        const extraFieldSelections = extraFieldDetailsLists.flatMap((fieldDetailsList) => toNodes(fieldDetailsList));
                        context.reportError(new GraphQLError(operationName != null
                            ? `Subscription "${operationName}" must select only one top level field.`
                            : 'Anonymous Subscription must select only one top level field.', { nodes: extraFieldSelections }));
                    }
                    for (const fieldDetailsList of groupedFieldSet.values()) {
                        const fieldName = toNodes(fieldDetailsList)[0].name.value;
                        if (fieldName.startsWith('__')) {
                            context.reportError(new GraphQLError(operationName != null
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