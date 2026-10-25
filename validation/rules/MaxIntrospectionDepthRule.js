"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaxIntrospectionDepthRule = MaxIntrospectionDepthRule;
const GraphQLError_ts_1 = require("../../error/GraphQLError.js");
const kinds_ts_1 = require("../../language/kinds.js");
const MAX_LISTS_DEPTH = 3;
function MaxIntrospectionDepthRule(context) {
    function checkDepth(node, visitedFragments = Object.create(null), depth = 0) {
        if (node.kind === kinds_ts_1.Kind.FRAGMENT_SPREAD) {
            const fragmentName = node.name.value;
            const visitedDepth = visitedFragments[fragmentName];
            if (visitedDepth !== undefined && visitedDepth >= depth) {
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
                if (checkDepth(node)) {
                    context.reportError(new GraphQLError_ts_1.GraphQLError('Maximum introspection depth exceeded', {
                        nodes: [node],
                    }));
                    return false;
                }
            }
        },
    };
}
//# sourceMappingURL=MaxIntrospectionDepthRule.js.map