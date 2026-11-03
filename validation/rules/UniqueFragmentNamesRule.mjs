import { GraphQLError } from "../../error/GraphQLError.mjs";
export function UniqueFragmentNamesRule(context) {
    const knownFragmentNames = new Map();
    return {
        OperationDefinition: () => false,
        FragmentDefinition(node) {
            const fragmentName = node.name.value;
            const knownFragmentName = knownFragmentNames.get(fragmentName);
            if (knownFragmentName != null) {
                context.reportError(new GraphQLError(`There can be only one fragment named "${fragmentName}".`, { nodes: [knownFragmentName, node.name] }));
            }
            else {
                knownFragmentNames.set(fragmentName, node.name);
            }
            return false;
        },
    };
}
//# sourceMappingURL=UniqueFragmentNamesRule.mjs.map