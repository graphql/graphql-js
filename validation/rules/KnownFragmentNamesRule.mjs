import { GraphQLError } from "../../error/GraphQLError.mjs";
export function KnownFragmentNamesRule(context) {
    return {
        FragmentSpread(node) {
            const fragmentName = node.name.value;
            const fragment = context.getFragment(fragmentName);
            if (!fragment) {
                context.reportError(new GraphQLError(`Unknown fragment "${fragmentName}".`, {
                    nodes: node.name,
                }));
            }
        },
    };
}
//# sourceMappingURL=KnownFragmentNamesRule.mjs.map