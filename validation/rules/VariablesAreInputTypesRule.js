'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.VariablesAreInputTypesRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const printer_js_1 = require('../../language/printer.js');
const definition_js_1 = require('../../type/definition.js');
const typeFromAST_js_1 = require('../../utilities/typeFromAST.js');
/**
 * Variables are input types
 *
 * A GraphQL operation is only valid if all the variables it defines are of
 * input types (scalar, enum, or input object).
 *
 * See https://spec.graphql.org/draft/#sec-Variables-Are-Input-Types
 */
function VariablesAreInputTypesRule(context) {
  return {
    VariableDefinition(node) {
      const type = (0, typeFromAST_js_1.typeFromAST)(
        context.getSchema(),
        node.type,
      );
      if (type !== undefined && !(0, definition_js_1.isInputType)(type)) {
        const variableName = node.variable.name.value;
        const typeName = (0, printer_js_1.print)(node.type);
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `Variable "$${variableName}" cannot be non-input type "${typeName}".`,
            { nodes: node.type },
          ),
        );
      }
    },
  };
}
exports.VariablesAreInputTypesRule = VariablesAreInputTypesRule;
