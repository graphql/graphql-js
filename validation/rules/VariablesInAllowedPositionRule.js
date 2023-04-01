'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.VariablesInAllowedPositionRule = void 0;
const inspect_js_1 = require('../../jsutils/inspect.js');
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const kinds_js_1 = require('../../language/kinds.js');
const definition_js_1 = require('../../type/definition.js');
const typeComparators_js_1 = require('../../utilities/typeComparators.js');
const typeFromAST_js_1 = require('../../utilities/typeFromAST.js');
/**
 * Variables in allowed position
 *
 * Variable usages must be compatible with the arguments they are passed to.
 *
 * See https://spec.graphql.org/draft/#sec-All-Variable-Usages-are-Allowed
 */
function VariablesInAllowedPositionRule(context) {
  let varDefMap;
  return {
    OperationDefinition: {
      enter() {
        varDefMap = new Map();
      },
      leave(operation) {
        const usages = context.getRecursiveVariableUsages(operation);
        for (const { node, type, defaultValue } of usages) {
          const varName = node.name.value;
          const varDef = varDefMap.get(varName);
          if (varDef && type) {
            // A var type is allowed if it is the same or more strict (e.g. is
            // a subtype of) than the expected type. It can be more strict if
            // the variable type is non-null when the expected type is nullable.
            // If both are list types, the variable item type can be more strict
            // than the expected item type (contravariant).
            const schema = context.getSchema();
            const varType = (0, typeFromAST_js_1.typeFromAST)(
              schema,
              varDef.type,
            );
            if (
              varType &&
              !allowedVariableUsage(
                schema,
                varType,
                varDef.defaultValue,
                type,
                defaultValue,
              )
            ) {
              const varTypeStr = (0, inspect_js_1.inspect)(varType);
              const typeStr = (0, inspect_js_1.inspect)(type);
              context.reportError(
                new GraphQLError_js_1.GraphQLError(
                  `Variable "$${varName}" of type "${varTypeStr}" used in position expecting type "${typeStr}".`,
                  { nodes: [varDef, node] },
                ),
              );
            }
          }
        }
      },
    },
    VariableDefinition(node) {
      varDefMap.set(node.variable.name.value, node);
    },
  };
}
exports.VariablesInAllowedPositionRule = VariablesInAllowedPositionRule;
/**
 * Returns true if the variable is allowed in the location it was found,
 * which includes considering if default values exist for either the variable
 * or the location at which it is located.
 */
function allowedVariableUsage(
  schema,
  varType,
  varDefaultValue,
  locationType,
  locationDefaultValue,
) {
  if (
    (0, definition_js_1.isNonNullType)(locationType) &&
    !(0, definition_js_1.isNonNullType)(varType)
  ) {
    const hasNonNullVariableDefaultValue =
      varDefaultValue != null && varDefaultValue.kind !== kinds_js_1.Kind.NULL;
    const hasLocationDefaultValue = locationDefaultValue !== undefined;
    if (!hasNonNullVariableDefaultValue && !hasLocationDefaultValue) {
      return false;
    }
    const nullableLocationType = locationType.ofType;
    return (0, typeComparators_js_1.isTypeSubTypeOf)(
      schema,
      varType,
      nullableLocationType,
    );
  }
  return (0, typeComparators_js_1.isTypeSubTypeOf)(
    schema,
    varType,
    locationType,
  );
}
