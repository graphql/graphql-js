import { GraphQLError } from "../../error/GraphQLError.mjs";
import { Kind } from "../../language/kinds.mjs";
const MAX_LISTS_DEPTH = 3;
export function MaxIntrospectionDepthRule(context) {
    const checkedFragments = Object.create(null);
    const exceededFragments = Object.create(null);
    function checkDepth(node, visitedFragments, depth = 0) {
        if (node.kind === Kind.FRAGMENT_SPREAD) {
            const fragmentName = node.name.value;
            const exceededEntryDepth = exceededFragments[fragmentName];
            if (exceededEntryDepth !== undefined && exceededEntryDepth <= depth) {
                return true;
            }
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
            if (checkDepth(fragment, visitedFragments, depth)) {
                exceededFragments[fragmentName] = depth;
                return true;
            }
            checkedFragments[fragmentName] = depth;
            return false;
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
                const visitedFragments = Object.create(null);
                if (checkDepth(node, visitedFragments)) {
                    context.reportError(new GraphQLError('Maximum introspection depth exceeded', {
                        nodes: [node],
                    }));
                    return false;
                }
            }
        },
    };
}
//# sourceMappingURL=MaxIntrospectionDepthRule.mjs.map