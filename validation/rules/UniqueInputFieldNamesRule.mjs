import { invariant } from '../../jsutils/invariant.mjs';
import { GraphQLError } from '../../error/GraphQLError.mjs';
/**
 * Unique input field names
 *
 * A GraphQL input object value is only valid if all supplied fields are
 * uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Input-Object-Field-Uniqueness
 */
export function UniqueInputFieldNamesRule(context) {
  const knownNameStack = [];
  let knownNames = new Map();
  return {
    ObjectValue: {
      enter() {
        knownNameStack.push(knownNames);
        knownNames = new Map();
      },
      leave() {
        const prevKnownNames = knownNameStack.pop();
        prevKnownNames != null || invariant(false);
        knownNames = prevKnownNames;
      },
    },
    ObjectField(node) {
      const fieldName = node.name.value;
      const knownName = knownNames.get(fieldName);
      if (knownName != null) {
        context.reportError(
          new GraphQLError(
            `There can be only one input field named "${fieldName}".`,
            { nodes: [knownName, node.name] },
          ),
        );
      } else {
        knownNames.set(fieldName, node.name);
      }
    },
  };
}
