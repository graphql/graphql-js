'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.UniqueFragmentNamesRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
/**
 * Unique fragment names
 *
 * A GraphQL document is only valid if all defined fragments have unique names.
 *
 * See https://spec.graphql.org/draft/#sec-Fragment-Name-Uniqueness
 */
function UniqueFragmentNamesRule(context) {
  const knownFragmentNames = Object.create(null);
  return {
    OperationDefinition: () => false,
    FragmentDefinition(node) {
      const fragmentName = node.name.value;
      if (knownFragmentNames[fragmentName]) {
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `There can be only one fragment named "${fragmentName}".`,
            { nodes: [knownFragmentNames[fragmentName], node.name] },
          ),
        );
      } else {
        knownFragmentNames[fragmentName] = node.name;
      }
      return false;
    },
  };
}
exports.UniqueFragmentNamesRule = UniqueFragmentNamesRule;
