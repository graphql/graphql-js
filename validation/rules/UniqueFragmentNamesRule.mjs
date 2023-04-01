import { GraphQLError } from '../../error/GraphQLError.mjs';
/**
 * Unique fragment names
 *
 * A GraphQL document is only valid if all defined fragments have unique names.
 *
 * See https://spec.graphql.org/draft/#sec-Fragment-Name-Uniqueness
 */
export function UniqueFragmentNamesRule(context) {
  const knownFragmentNames = new Map();
  return {
    OperationDefinition: () => false,
    FragmentDefinition(node) {
      const fragmentName = node.name.value;
      const knownFragmentName = knownFragmentNames.get(fragmentName);
      if (knownFragmentName != null) {
        context.reportError(
          new GraphQLError(
            `There can be only one fragment named "${fragmentName}".`,
            { nodes: [knownFragmentName, node.name] },
          ),
        );
      } else {
        knownFragmentNames.set(fragmentName, node.name);
      }
      return false;
    },
  };
}
