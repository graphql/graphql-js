import { GraphQLError } from "../../error/GraphQLError.mjs";
import { Kind } from "../../language/kinds.mjs";
import { getNamedType, isInputObjectType, isNonNullType, isNullableType, } from "../../type/definition.mjs";
import { isTypeSubTypeOf } from "../../utilities/typeComparators.mjs";
import { typeFromAST } from "../../utilities/typeFromAST.mjs";
export function VariablesInAllowedPositionRule(context) {
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
                for (const usage of usages) {
                    const { node, type, fragmentVariableDefinition } = usage;
                    const varName = node.name.value;
                    let varDef = fragmentVariableDefinition;
                    varDef ??= varDefMap.get(varName);
                    if (varDef && type) {
                        const schema = context.getSchema();
                        const varType = typeFromAST(schema, varDef.type);
                        if (varType &&
                            !allowedVariableUsage(schema, varType, varDef.defaultValue, type, usage.defaultValue)) {
                            context.reportError(new GraphQLError(`Variable "$${varName}" of type "${varType}" used in position expecting type "${type}".`, { nodes: [varDef, node] }));
                        }
                        if (isOneOfFieldPosition(usage) && isNullableType(varType)) {
                            context.reportError(new GraphQLError(`Variable "$${varName}" is of type "${varType}" but must be non-nullable to be used for OneOf Input Object "${getNamedType(usage.parentType)}".`, { nodes: [varDef, node] }));
                        }
                    }
                }
            },
        },
    };
}
function allowedVariableUsage(schema, varType, varDefaultValue, locationType, locationDefaultValue) {
    if (isNonNullType(locationType) && !isNonNullType(varType)) {
        const hasNonNullVariableDefaultValue = varDefaultValue != null && varDefaultValue.kind !== Kind.NULL;
        const hasLocationDefaultValue = locationDefaultValue !== undefined;
        if (!hasNonNullVariableDefaultValue && !hasLocationDefaultValue) {
            return false;
        }
        const nullableLocationType = locationType.ofType;
        return isTypeSubTypeOf(schema, varType, nullableLocationType);
    }
    return isTypeSubTypeOf(schema, varType, locationType);
}
function isOneOfFieldPosition(usage) {
    const parentNamedType = getNamedType(usage.parentType);
    return (usage.isObjectField &&
        isInputObjectType(parentNamedType) &&
        parentNamedType.isOneOf);
}
//# sourceMappingURL=VariablesInAllowedPositionRule.mjs.map