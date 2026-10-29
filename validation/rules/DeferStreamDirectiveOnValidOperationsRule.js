"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeferStreamDirectiveOnValidOperationsRule = DeferStreamDirectiveOnValidOperationsRule;
const GraphQLError_ts_1 = require("../../error/GraphQLError.js");
const ast_ts_1 = require("../../language/ast.js");
const kinds_ts_1 = require("../../language/kinds.js");
const directives_ts_1 = require("../../type/directives.js");
function ifArgumentCanBeFalse(node) {
    const ifArgument = node.arguments?.find((arg) => arg.name.value === 'if');
    if (!ifArgument) {
        return false;
    }
    if (ifArgument.value.kind === kinds_ts_1.Kind.BOOLEAN) {
        if (ifArgument.value.value) {
            return false;
        }
    }
    else if (ifArgument.value.kind !== kinds_ts_1.Kind.VARIABLE) {
        return false;
    }
    return true;
}
function canBeSkippedViaSkipDirective(node) {
    const ifArgument = node.arguments?.find((arg) => arg.name.value === 'if');
    if (!ifArgument) {
        return true;
    }
    if (ifArgument.value.kind === kinds_ts_1.Kind.BOOLEAN) {
        if (ifArgument.value.value) {
            return true;
        }
        return false;
    }
    return true;
}
function canBeSkippedViaIncludeDirective(node) {
    const ifArgument = node.arguments?.find((arg) => arg.name.value === 'if');
    if (!ifArgument) {
        return false;
    }
    if (ifArgument?.value.kind === kinds_ts_1.Kind.BOOLEAN) {
        if (ifArgument.value.value) {
            return false;
        }
        return true;
    }
    return true;
}
function DeferStreamDirectiveOnValidOperationsRule(context) {
    return {
        OperationDefinition(operation) {
            if (operation.operation !== ast_ts_1.OperationTypeNode.SUBSCRIPTION) {
                return;
            }
            const visitedFragments = new Set();
            forbidUnconditionalDeferStream({
                context,
                selectionSet: operation.selectionSet,
                parentNodes: [],
                visitedFragments,
            });
        },
    };
}
function forbidUnconditionalDeferStream({ context, selectionSet, parentNodes, visitedFragments, }) {
    for (const selection of selectionSet.selections) {
        const skip = selection.directives?.find((d) => d.name.value === directives_ts_1.GraphQLSkipDirective.name);
        if (skip && canBeSkippedViaSkipDirective(skip)) {
            continue;
        }
        const include = selection.directives?.find((d) => d.name.value === directives_ts_1.GraphQLIncludeDirective.name);
        if (include && canBeSkippedViaIncludeDirective(include)) {
            continue;
        }
        for (const directive of selection.directives ?? []) {
            if (directive.name.value === directives_ts_1.GraphQLDeferDirective.name) {
                if (!ifArgumentCanBeFalse(directive)) {
                    context.reportError(new GraphQLError_ts_1.GraphQLError('Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.', { nodes: [directive, ...parentNodes.toReversed()] }));
                }
            }
            else if (directive.name.value === directives_ts_1.GraphQLStreamDirective.name) {
                if (!ifArgumentCanBeFalse(directive)) {
                    context.reportError(new GraphQLError_ts_1.GraphQLError('Stream directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.', { nodes: [directive, ...parentNodes.toReversed()] }));
                }
            }
        }
        if (selection.kind === 'FragmentSpread') {
            const fragmentName = selection.name.value;
            if (visitedFragments.has(fragmentName)) {
                continue;
            }
            visitedFragments.add(fragmentName);
            const fragment = context.getFragment(fragmentName);
            if (fragment) {
                parentNodes.push(selection);
                forbidUnconditionalDeferStream({
                    context,
                    parentNodes,
                    selectionSet: fragment?.selectionSet,
                    visitedFragments,
                });
                parentNodes.pop();
            }
        }
        else if (selection.selectionSet) {
            forbidUnconditionalDeferStream({
                context,
                selectionSet: selection.selectionSet,
                parentNodes,
                visitedFragments,
            });
        }
    }
}
//# sourceMappingURL=DeferStreamDirectiveOnValidOperationsRule.js.map