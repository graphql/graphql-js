"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VariablesInAllowedPositionRule = VariablesInAllowedPositionRule;
const GraphQLError_ts_1 = require("../../error/GraphQLError.js");
const kinds_ts_1 = require("../../language/kinds.js");
const definition_ts_1 = require("../../type/definition.js");
const typeComparators_ts_1 = require("../../utilities/typeComparators.js");
const typeFromAST_ts_1 = require("../../utilities/typeFromAST.js");
function VariablesInAllowedPositionRule(context) {
    let varDefMap;
    return {
        OperationDefinition: {
            enter(operation) {
                varDefMap = new Map();
                if (operation.variableDefinitions) {
                    for (const varDef of operation.variableDefinitions) {
                        varDefMap.set(varDef.variable.name.value, varDef);
                    }
                }
            },
            leave(operation) {
                const usages = context.getRecursiveVariableUsages(operation);
                for (const { node, type, parentType, defaultValue, fragmentVariableDefinition, } of usages) {
                    const varName = node.name.value;
                    let varDef = fragmentVariableDefinition;
                    varDef ??= varDefMap.get(varName);
                    if (varDef && type) {
                        const schema = context.getSchema();
                        const varType = (0, typeFromAST_ts_1.typeFromAST)(schema, varDef.type);
                        if (varType &&
                            !allowedVariableUsage(schema, varType, varDef.defaultValue, type, defaultValue)) {
                            context.reportError(new GraphQLError_ts_1.GraphQLError(`Variable "$${varName}" of type "${varType}" used in position expecting type "${type}".`, { nodes: [varDef, node] }));
                        }
                        const nullableParentType = (0, definition_ts_1.getNullableType)(parentType);
                        if ((0, definition_ts_1.isInputObjectType)(nullableParentType) &&
                            nullableParentType.isOneOf &&
                            (0, definition_ts_1.isNullableType)(varType)) {
                            context.reportError(new GraphQLError_ts_1.GraphQLError(`Variable "$${varName}" is of type "${varType}" but must be non-nullable to be used for OneOf Input Object "${nullableParentType}".`, { nodes: [varDef, node] }));
                        }
                    }
                }
            },
        },
    };
}
function allowedVariableUsage(schema, varType, varDefaultValue, locationType, locationDefaultValue) {
    if ((0, definition_ts_1.isNonNullType)(locationType) && !(0, definition_ts_1.isNonNullType)(varType)) {
        const hasNonNullVariableDefaultValue = varDefaultValue != null && varDefaultValue.kind !== kinds_ts_1.Kind.NULL;
        const hasLocationDefaultValue = locationDefaultValue !== undefined;
        if (!hasNonNullVariableDefaultValue && !hasLocationDefaultValue) {
            return false;
        }
        const nullableLocationType = locationType.ofType;
        return (0, typeComparators_ts_1.isTypeSubTypeOf)(schema, varType, nullableLocationType);
    }
    return (0, typeComparators_ts_1.isTypeSubTypeOf)(schema, varType, locationType);
}
//# sourceMappingURL=VariablesInAllowedPositionRule.js.map