import { GraphQLError } from '../../error/GraphQLError.mjs';
/**
 * Unique operation names
 *
 * A GraphQL document is only valid if all defined operations have unique names.
 *
 * See https://spec.graphql.org/draft/#sec-Operation-Name-Uniqueness
 */
export function UniqueOperationNamesRule(context) {
  const knownOperationNames = new Map();
  return {
    OperationDefinition(node) {
      const operationName = node.name;
      if (operationName != null) {
        const knownOperationName = knownOperationNames.get(operationName.value);
        if (knownOperationName != null) {
          context.reportError(
            new GraphQLError(
              `There can be only one operation named "${operationName.value}".`,
              { nodes: [knownOperationName, operationName] },
            ),
          );
        } else {
          knownOperationNames.set(operationName.value, operationName);
        }
      }
      return false;
    },
    FragmentDefinition: () => false,
  };
}
