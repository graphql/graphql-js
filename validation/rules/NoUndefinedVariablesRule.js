'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.NoUndefinedVariablesRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
/**
 * No undefined variables
 *
 * A GraphQL operation is only valid if all variables encountered, both directly
 * and via fragment spreads, are defined by that operation.
 *
 * See https://spec.graphql.org/draft/#sec-All-Variable-Uses-Defined
 */
function NoUndefinedVariablesRule(context) {
  return {
    OperationDefinition(operation) {
      const variableNameDefined = new Set(
        operation.variableDefinitions?.map((node) => node.variable.name.value),
      );
      const usages = context.getRecursiveVariableUsages(operation);
      for (const { node } of usages) {
        const varName = node.name.value;
        if (!variableNameDefined.has(varName)) {
          context.reportError(
            new GraphQLError_js_1.GraphQLError(
              operation.name
                ? `Variable "$${varName}" is not defined by operation "${operation.name.value}".`
                : `Variable "$${varName}" is not defined.`,
              { nodes: [node, operation] },
            ),
          );
        }
      }
    },
  };
}
exports.NoUndefinedVariablesRule = NoUndefinedVariablesRule;
