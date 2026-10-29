import { GraphQLError } from "../../error/GraphQLError.mjs";
import { GraphQLDeferDirective, GraphQLStreamDirective, } from "../../type/directives.mjs";
export function DeferStreamDirectiveOnRootFieldRule(context) {
    const checkedFragments = new Set();
    return {
        OperationDefinition(node) {
            if (node.operation !== 'subscription' && node.operation !== 'mutation') {
                return;
            }
            const schema = context.getSchema();
            const rootType = schema.getRootType(node.operation);
            if (rootType) {
                const visitedFragments = new Set();
                if (forbidDeferStream({
                    context,
                    operationType: node.operation,
                    rootType,
                    checkedFragments,
                    selectionSet: node.selectionSet,
                    visitedFragments,
                })) {
                    for (const name of visitedFragments) {
                        checkedFragments.add(name);
                    }
                }
            }
        },
    };
}
function forbidDeferStream({ context, operationType, rootType, checkedFragments, selectionSet, visitedFragments, }) {
    let valid = true;
    for (const selection of selectionSet.selections) {
        if (selection.kind === 'Field') {
            const stream = selection.directives?.find((d) => d.name.value === GraphQLStreamDirective.name);
            if (stream) {
                valid = false;
                context.reportError(new GraphQLError(`Stream directive cannot be used on root ${operationType} type "${rootType}".`, { nodes: stream }));
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
                    valid = false;
                    context.reportError(new GraphQLError(`Defer directive cannot be used on root ${operationType} type "${rootType}".`, { nodes: defer }));
                }
                if (!checkedFragments.has(fragmentName)) {
                    valid =
                        forbidDeferStream({
                            context,
                            operationType,
                            rootType,
                            checkedFragments,
                            selectionSet: fragment.selectionSet,
                            visitedFragments,
                        }) && valid;
                }
            }
        }
        else if (selection.kind === 'InlineFragment') {
            const defer = getDeferDirective(selection);
            if (defer !== undefined) {
                valid = false;
                context.reportError(new GraphQLError(`Defer directive cannot be used on root ${operationType} type "${rootType}".`, { nodes: defer }));
            }
            valid =
                forbidDeferStream({
                    context,
                    operationType,
                    rootType,
                    checkedFragments,
                    selectionSet: selection.selectionSet,
                    visitedFragments,
                }) && valid;
        }
    }
    return valid;
}
function getDeferDirective(fragment) {
    return fragment.directives?.find((d) => d.name.value === GraphQLDeferDirective.name);
}
//# sourceMappingURL=DeferStreamDirectiveOnRootFieldRule.js.map