'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.LoneAnonymousOperationRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const kinds_js_1 = require('../../language/kinds.js');
/**
 * Lone anonymous operation
 *
 * A GraphQL document is only valid if when it contains an anonymous operation
 * (the query short-hand) that it contains only that one operation definition.
 *
 * See https://spec.graphql.org/draft/#sec-Lone-Anonymous-Operation
 */
function LoneAnonymousOperationRule(context) {
  let operationCount = 0;
  return {
    Document(node) {
      operationCount = node.definitions.filter(
        (definition) =>
          definition.kind === kinds_js_1.Kind.OPERATION_DEFINITION,
      ).length;
    },
    OperationDefinition(node) {
      if (!node.name && operationCount > 1) {
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            'This anonymous operation must be the only defined operation.',
            { nodes: node },
          ),
        );
      }
    },
  };
}
exports.LoneAnonymousOperationRule = LoneAnonymousOperationRule;
