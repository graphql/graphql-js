import { inspect } from "../jsutils/inspect.mjs";
import { invariant } from "../jsutils/invariant.mjs";
import { Kind } from "../language/kinds.mjs";
import { isInputObjectType, isLeafType, isListType, isNonNullType, } from "../type/definition.mjs";
export function valueFromAST(valueNode, type, variables) {
    if (!valueNode) {
        return;
    }
    if (valueNode.kind === Kind.VARIABLE) {
        const variableName = valueNode.name.value;
        if (variables == null || !Object.hasOwn(variables, variableName)) {
            return;
        }
        const variableValue = variables[variableName];
        if (variableValue === undefined) {
            return;
        }
        if (variableValue === null && isNonNullType(type)) {
            return;
        }
        return variableValue;
    }
    if (isNonNullType(type)) {
        if (valueNode.kind === Kind.NULL) {
            return;
        }
        return valueFromAST(valueNode, type.ofType, variables);
    }
    if (valueNode.kind === Kind.NULL) {
        return null;
    }
    if (isListType(type)) {
        const itemType = type.ofType;
        if (valueNode.kind === Kind.LIST) {
            const coercedValues = [];
            for (const itemNode of valueNode.values) {
                if (isMissingVariable(itemNode, variables)) {
                    if (isNonNullType(itemType)) {
                        return;
                    }
                    coercedValues.push(null);
                }
                else {
                    const itemValue = valueFromAST(itemNode, itemType, variables);
                    if (itemValue === undefined) {
                        return;
                    }
                    coercedValues.push(itemValue);
                }
            }
            return coercedValues;
        }
        const coercedValue = valueFromAST(valueNode, itemType, variables);
        if (coercedValue === undefined) {
            return;
        }
        return [coercedValue];
    }
    if (isInputObjectType(type)) {
        if (valueNode.kind !== Kind.OBJECT) {
            return;
        }
        const coercedObj = Object.create(null);
        const fieldDefs = type.getFields();
        const hasUnknownField = valueNode.fields.some((field) => !Object.hasOwn(fieldDefs, field.name.value));
        if (hasUnknownField) {
            return;
        }
        const fieldNodes = new Map(valueNode.fields.map((field) => [field.name.value, field]));
        for (const field of Object.values(fieldDefs)) {
            const fieldNode = fieldNodes.get(field.name);
            if (fieldNode == null || isMissingVariable(fieldNode.value, variables)) {
                if (field.defaultValue !== undefined) {
                    coercedObj[field.name] = field.defaultValue;
                }
                else if (isNonNullType(field.type)) {
                    return;
                }
                continue;
            }
            const fieldValue = valueFromAST(fieldNode.value, field.type, variables);
            if (fieldValue === undefined) {
                return;
            }
            coercedObj[field.name] = fieldValue;
        }
        if (type.isOneOf) {
            const coercedKeys = Object.keys(coercedObj);
            if (fieldNodes.size !== 1 || coercedKeys.length !== 1) {
                return;
            }
            for (const [fieldName, fieldNode] of fieldNodes) {
                if (fieldNode.value.kind === Kind.NULL ||
                    coercedObj[fieldName] === null) {
                    return;
                }
            }
        }
        return coercedObj;
    }
    if (isLeafType(type)) {
        let result;
        try {
            result = type.parseLiteral(valueNode, variables);
        }
        catch (_error) {
            return;
        }
        if (result === undefined) {
            return;
        }
        return result;
    }
    invariant(false, 'Unexpected input type: ' + inspect(type));
}
function isMissingVariable(valueNode, variables) {
    return (valueNode.kind === Kind.VARIABLE &&
        (variables?.[valueNode.name.value] === undefined ||
            !Object.hasOwn(variables, valueNode.name.value)));
}
//# sourceMappingURL=valueFromAST.mjs.map