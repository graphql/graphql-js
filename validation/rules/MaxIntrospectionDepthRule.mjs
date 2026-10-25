import { GraphQLError } from "../../error/GraphQLError.mjs";
import { Kind } from "../../language/kinds.mjs";
const MAX_LISTS_DEPTH = 3;
export function MaxIntrospectionDepthRule(context) {
    function checkDepth(node, visitedFragments = Object.create(null), depth = 0) {
        if (node.kind === Kind.FRAGMENT_SPREAD) {
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
        if (node.kind === Kind.FIELD &&
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
                    context.reportError(new GraphQLError('Maximum introspection depth exceeded', {
                        nodes: [node],
                    }));
                    return false;
                }
            }
        },
    };
}
//# sourceMappingURL=MaxIntrospectionDepthRule.js.map