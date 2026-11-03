import { inspect } from "../jsutils/inspect.mjs";
import { invariant } from "../jsutils/invariant.mjs";
import { isIterableObject } from "../jsutils/isIterableObject.mjs";
import { isObjectLike } from "../jsutils/isObjectLike.mjs";
import { Kind } from "../language/kinds.mjs";
import { assertLeafType, isInputObjectType, isListType, isNonNullType, isRequiredInputField, } from "../type/definition.mjs";
import { replaceVariables } from "./replaceVariables.mjs";
export function coerceInputValue(inputValue, type) {
    if (isNonNullType(type)) {
        if (inputValue == null) {
            return;
        }
        return coerceInputValue(inputValue, type.ofType);
    }
    if (inputValue == null) {
        return null;
    }
    if (isListType(type)) {
        if (!isIterableObject(inputValue)) {
            const coercedItem = coerceInputValue(inputValue, type.ofType);
            if (coercedItem === undefined) {
                return;
            }
            return [coercedItem];
        }
        const coercedValue = [];
        for (const itemValue of inputValue) {
            const coercedItem = coerceInputValue(itemValue, type.ofType);
            if (coercedItem === undefined) {
                return;
            }
            coercedValue.push(coercedItem);
        }
        return coercedValue;
    }
    if (isInputObjectType(type)) {
        if (!isObjectLike(inputValue) || Array.isArray(inputValue)) {
            return;
        }
        const coercedValue = Object.create(null);
        const fieldDefs = type.getFields();
        let definedFieldCount = 0;
        for (const fieldName of Object.keys(inputValue)) {
            if (inputValue[fieldName] === undefined) {
                continue;
            }
            definedFieldCount++;
            if (!Object.hasOwn(fieldDefs, fieldName)) {
                return;
            }
        }
        for (const field of Object.values(fieldDefs)) {
            const fieldValue = inputValue[field.name];
            if (fieldValue === undefined) {
                if (isRequiredInputField(field)) {
                    return;
                }
                const coercedDefaultValue = coerceDefaultValue(field);
                if (coercedDefaultValue !== undefined) {
                    coercedValue[field.name] = coercedDefaultValue;
                }
            }
            else {
                const coercedField = coerceInputValue(fieldValue, field.type);
                if (coercedField === undefined) {
                    return;
                }
                coercedValue[field.name] = coercedField;
            }
        }
        if (type.isOneOf) {
            const keys = Object.keys(coercedValue);
            if (definedFieldCount !== 1 || keys.length !== 1) {
                return;
            }
            const key = keys[0];
            const value = coercedValue[key];
            if (value === null) {
                return;
            }
        }
        return coercedValue;
    }
    const leafType = assertLeafType(type);
    try {
        return leafType.coerceInputValue(inputValue);
    }
    catch (_error) {
    }
}
export function coerceInputLiteral(valueNode, type, variableValues, fragmentVariableValues) {
    if (valueNode.kind === Kind.VARIABLE) {
        const coercedVariableValue = getCoercedVariableValue(valueNode, variableValues, fragmentVariableValues);
        if (coercedVariableValue == null && isNonNullType(type)) {
            return;
        }
        return coercedVariableValue;
    }
    if (isNonNullType(type)) {
        if (valueNode.kind === Kind.NULL) {
            return;
        }
        return coerceInputLiteral(valueNode, type.ofType, variableValues, fragmentVariableValues);
    }
    if (valueNode.kind === Kind.NULL) {
        return null;
    }
    if (isListType(type)) {
        if (valueNode.kind !== Kind.LIST) {
            const itemValue = coerceInputLiteral(valueNode, type.ofType, variableValues, fragmentVariableValues);
            if (itemValue === undefined) {
                return;
            }
            return [itemValue];
        }
        const coercedValue = [];
        for (const itemNode of valueNode.values) {
            let itemValue = coerceInputLiteral(itemNode, type.ofType, variableValues, fragmentVariableValues);
            if (itemValue === undefined) {
                if (itemNode.kind === Kind.VARIABLE &&
                    getCoercedVariableValue(itemNode, variableValues, fragmentVariableValues) == null &&
                    !isNonNullType(type.ofType)) {
                    itemValue = null;
                }
                else {
                    return;
                }
            }
            coercedValue.push(itemValue);
        }
        return coercedValue;
    }
    if (isInputObjectType(type)) {
        if (valueNode.kind !== Kind.OBJECT) {
            return;
        }
        const coercedValue = Object.create(null);
        const fieldDefs = type.getFields();
        const hasUndefinedField = valueNode.fields.some((field) => !Object.hasOwn(fieldDefs, field.name.value));
        if (hasUndefinedField) {
            return;
        }
        const fieldNodes = new Map(valueNode.fields.map((field) => [field.name.value, field]));
        for (const field of Object.values(fieldDefs)) {
            const fieldNode = fieldNodes.get(field.name);
            if (!fieldNode ||
                (fieldNode.value.kind === Kind.VARIABLE &&
                    isMissingVariable(fieldNode.value, variableValues, fragmentVariableValues))) {
                if (isRequiredInputField(field)) {
                    return;
                }
                const coercedDefaultValue = coerceDefaultValue(field);
                if (coercedDefaultValue !== undefined) {
                    coercedValue[field.name] = coercedDefaultValue;
                }
            }
            else {
                const fieldValue = coerceInputLiteral(fieldNode.value, field.type, variableValues, fragmentVariableValues);
                if (fieldValue === undefined) {
                    return;
                }
                coercedValue[field.name] = fieldValue;
            }
        }
        if (type.isOneOf) {
            const coercedKeys = Object.keys(coercedValue);
            if (fieldNodes.size !== 1 || coercedKeys.length !== 1) {
                return;
            }
            for (const [fieldName, fieldNode] of fieldNodes) {
                if (fieldNode.value.kind === Kind.NULL ||
                    coercedValue[fieldName] === null) {
                    return;
                }
            }
        }
        return coercedValue;
    }
    const leafType = assertLeafType(type);
    try {
        return leafType.coerceInputLiteral
            ? leafType.coerceInputLiteral(replaceVariables(valueNode, variableValues, fragmentVariableValues))
            : leafType.parseLiteral(valueNode, variableValues?.coerced);
    }
    catch (_error) {
    }
}
function getCoercedVariableValue(variableNode, variableValues, fragmentVariableValues) {
    const varName = variableNode.name.value;
    if (fragmentVariableValues?.sources[varName] !== undefined) {
        return fragmentVariableValues.coerced[varName];
    }
    return variableValues?.coerced[varName];
}
function isMissingVariable(variableNode, variableValues, fragmentVariableValues) {
    const varName = variableNode.name.value;
    const scopedValues = fragmentVariableValues?.sources[varName] !== undefined
        ? fragmentVariableValues.coerced
        : variableValues?.coerced;
    return scopedValues?.[varName] === undefined;
}
export function coerceDefaultValue(inputValue) {
    let coercedDefaultValue = inputValue._memoizedCoercedDefaultValue;
    if (coercedDefaultValue !== undefined) {
        return coercedDefaultValue;
    }
    const defaultInput = inputValue.default;
    if (defaultInput !== undefined) {
        coercedDefaultValue = defaultInput.literal
            ? coerceInputLiteral(defaultInput.literal, inputValue.type)
            : coerceInputValue(defaultInput.value, inputValue.type);
        if (!(coercedDefaultValue !== undefined))
            invariant(false, `Expected value of type "${inputValue.type}" to be valid, found: ${inspect(defaultInput.literal ?? defaultInput.value)}.`);
        inputValue._memoizedCoercedDefaultValue = coercedDefaultValue;
        return coercedDefaultValue;
    }
    const defaultValue = inputValue.defaultValue;
    if (defaultValue !== undefined) {
        inputValue._memoizedCoercedDefaultValue = defaultValue;
    }
    return defaultValue;
}
//# sourceMappingURL=coerceInputValue.mjs.map