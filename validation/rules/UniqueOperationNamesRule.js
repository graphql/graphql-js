'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.UniqueOperationNamesRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
/**
 * Unique operation names
 *
 * A GraphQL document is only valid if all defined operations have unique names.
 *
 * See https://spec.graphql.org/draft/#sec-Operation-Name-Uniqueness
 */
function UniqueOperationNamesRule(context) {
  const knownOperationNames = new Map();
  return {
    OperationDefinition(node) {
      const operationName = node.name;
      if (operationName != null) {
        const knownOperationName = knownOperationNames.get(operationName.value);
        if (knownOperationName != null) {
          context.reportError(
            new GraphQLError_js_1.GraphQLError(
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
exports.UniqueOperationNamesRule = UniqueOperationNamesRule;
