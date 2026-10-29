"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeferStreamDirectiveOnRootFieldRule = DeferStreamDirectiveOnRootFieldRule;
const GraphQLError_ts_1 = require("../../error/GraphQLError.js");
const directives_ts_1 = require("../../type/directives.js");
function DeferStreamDirectiveOnRootFieldRule(context) {
    return {
        OperationDefinition(node) {
            if (node.operation !== 'subscription' && node.operation !== 'mutation') {
                return;
            }
            const schema = context.getSchema();
            const rootType = schema.getRootType(node.operation);
            if (rootType) {
                forbidDeferStream({
                    context,
                    operationType: node.operation,
                    rootType,
                    selectionSet: node.selectionSet,
                    visitedFragments: new Set(),
                });
            }
        },
    };
}
function forbidDeferStream({ context, operationType, rootType, selectionSet, visitedFragments, }) {
    for (const selection of selectionSet.selections) {
        if (selection.kind === 'Field') {
            const stream = selection.directives?.find((d) => d.name.value === directives_ts_1.GraphQLStreamDirective.name);
            if (stream) {
                context.reportError(new GraphQLError_ts_1.GraphQLError(`Stream directive cannot be used on root ${operationType} type "${rootType}".`, { nodes: stream }));
            }
        }
        else if (selection.kind === 'FragmentSpread') {
            const fragmentName = selection.name.value;
            if (visitedFragments.has(fragmentName)) {
                continue;
            }
            visitedFragments.add(fragmentName);
            const fragment = context.getFragment(fragmentName);
            if (fragment) {
                const defer = getDeferDirective(selection);
                if (defer !== undefined) {
                    context.reportError(new GraphQLError_ts_1.GraphQLError(`Defer directive cannot be used on root ${operationType} type "${rootType}".`, { nodes: defer }));
                }
                forbidDeferStream({
                    context,
                    operationType,
                    rootType,
                    selectionSet: fragment.selectionSet,
                    visitedFragments,
                });
            }
        }
        else if (selection.kind === 'InlineFragment') {
            const defer = getDeferDirective(selection);
            if (defer !== undefined) {
                context.reportError(new GraphQLError_ts_1.GraphQLError(`Defer directive cannot be used on root ${operationType} type "${rootType}".`, { nodes: defer }));
            }
            forbidDeferStream({
                context,
                operationType,
                rootType,
                selectionSet: selection.selectionSet,
                visitedFragments,
            });
        }
    }
}
function getDeferDirective(fragment) {
    return fragment.directives?.find((d) => d.name.value === directives_ts_1.GraphQLDeferDirective.name);
}
//# sourceMappingURL=DeferStreamDirectiveOnRootFieldRule.js.map