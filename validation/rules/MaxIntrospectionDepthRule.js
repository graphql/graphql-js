"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaxIntrospectionDepthRule = MaxIntrospectionDepthRule;
const GraphQLError_ts_1 = require("../../error/GraphQLError.js");
const kinds_ts_1 = require("../../language/kinds.js");
const MAX_LISTS_DEPTH = 3;
function MaxIntrospectionDepthRule(context) {
    const checkedFragments = Object.create(null);
    function checkDepth(node, visitedFragments, depth = 0) {
        if (node.kind === kinds_ts_1.Kind.FRAGMENT_SPREAD) {
            const fragmentName = node.name.value;
            const visitedEntryDepth = visitedFragments[fragmentName];
            const checkedEntryDepth = checkedFragments[fragmentName];
            if ((visitedEntryDepth !== undefined && visitedEntryDepth >= depth) ||
                (checkedEntryDepth !== undefined && checkedEntryDepth >= depth)) {
                return false;
            }
            const fragment = context.getFragment(fragmentName);
            if (!fragment) {
                return false;
            }
            visitedFragments[fragmentName] = depth;
            return checkDepth(fragment, visitedFragments, depth);
        }
        if (node.kind === kinds_ts_1.Kind.FIELD &&
            (node.name.value === 'fields' ||
                node.name.value === 'interfaces' ||
                node.name.value === 'possibleTypes' ||
                node.name.value === 'inputFields')) {
            depth++;
            if (depth >= MAX_LISTS_DEPTH) {
                return true;
            }
        }
        if ('selectionSet' in node && node.selectionSet) {
            for (const child of node.selectionSet.selections) {
                if (checkDepth(child, visitedFragments, depth)) {
                    return true;
                }
            }
        }
        return false;
    }
    return {
        Field(node) {
            if (node.name.value === '__schema' || node.name.value === '__type') {
                const visitedFragments = Object.create(null);
                if (checkDepth(node, visitedFragments)) {
                    context.reportError(new GraphQLError_ts_1.GraphQLError('Maximum introspection depth exceeded', {
                        nodes: [node],
                    }));
                    return false;
                }
                for (const name of Object.keys(visitedFragments)) {
                    checkedFragments[name] = visitedFragments[name];
                }
            }
        },
    };
}
//# sourceMappingURL=MaxIntrospectionDepthRule.js.map