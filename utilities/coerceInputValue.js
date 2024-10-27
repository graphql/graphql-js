"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coerceDefaultValue = exports.coerceInputLiteral = exports.coerceInputValue = void 0;
const invariant_js_1 = require("../jsutils/invariant.js");
const isIterableObject_js_1 = require("../jsutils/isIterableObject.js");
const isObjectLike_js_1 = require("../jsutils/isObjectLike.js");
const kinds_js_1 = require("../language/kinds.js");
const definition_js_1 = require("../type/definition.js");
const replaceVariables_js_1 = require("./replaceVariables.js");
/**
 * Coerces a JavaScript value given a GraphQL Input Type.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 */
function coerceInputValue(inputValue, type) {
    if ((0, definition_js_1.isNonNullType)(type)) {
        if (inputValue == null) {
            return; // Invalid: intentionally return no value.
        }
        return coerceInputValue(inputValue, type.ofType);
    }
    if (inputValue == null) {
        return null; // Explicitly return the value null.
    }
    if ((0, definition_js_1.isListType)(type)) {
        if (!(0, isIterableObject_js_1.isIterableObject)(inputValue)) {
            // Lists accept a non-list value as a list of one.
            const coercedItem = coerceInputValue(inputValue, type.ofType);
            if (coercedItem === undefined) {
                return; // Invalid: intentionally return no value.
            }
            return [coercedItem];
        }
        const coercedValue = [];
        for (const itemValue of inputValue) {
            const coercedItem = coerceInputValue(itemValue, type.ofType);
            if (coercedItem === undefined) {
                return; // Invalid: intentionally return no value.
            }
            coercedValue.push(coercedItem);
        }
        return coercedValue;
    }
    if ((0, definition_js_1.isInputObjectType)(type)) {
        if (!(0, isObjectLike_js_1.isObjectLike)(inputValue)) {
            return; // Invalid: intentionally return no value.
        }
        const coercedValue = {};
        const fieldDefs = type.getFields();
        const hasUndefinedField = Object.keys(inputValue).some((name) => !Object.hasOwn(fieldDefs, name));
        if (hasUndefinedField) {
            return; // Invalid: intentionally return no value.
        }
        for (const field of Object.values(fieldDefs)) {
            const fieldValue = inputValue[field.name];
            if (fieldValue === undefined) {
                if ((0, definition_js_1.isRequiredInputField)(field)) {
                    return; // Invalid: intentionally return no value.
                }
                if (field.defaultValue) {
                    coercedValue[field.name] = coerceDefaultValue(field.defaultValue, field.type);
                }
            }
            else {
                const coercedField = coerceInputValue(fieldValue, field.type);
                if (coercedField === undefined) {
                    return; // Invalid: intentionally return no value.
                }
                coercedValue[field.name] = coercedField;
            }
        }
        if (type.isOneOf) {
            const keys = Object.keys(coercedValue);
            if (keys.length !== 1) {
                return; // Invalid: intentionally return no value.
            }
            const key = keys[0];
            const value = coercedValue[key];
            if (value === null) {
                return; // Invalid: intentionally return no value.
            }
        }
        return coercedValue;
    }
    const leafType = (0, definition_js_1.assertLeafType)(type);
    try {
        return leafType.coerceInputValue(inputValue);
    }
    catch (_error) {
        // Invalid: ignore error and intentionally return no value.
    }
}
exports.coerceInputValue = coerceInputValue;
/**
 * Produces a coerced "internal" JavaScript value given a GraphQL Value AST.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 */
function coerceInputLiteral(valueNode, type, variableValues, fragmentVariableValues) {
    if (valueNode.kind === kinds_js_1.Kind.VARIABLE) {
        const coercedVariableValue = getCoercedVariableValue(valueNode, variableValues, fragmentVariableValues);
        if (coercedVariableValue == null && (0, definition_js_1.isNonNullType)(type)) {
            return; // Invalid: intentionally return no value.
        }
        // Note: This does no further checking that this variable is correct.
        // This assumes validated has checked this variable is of the correct type.
        return coercedVariableValue;
    }
    if ((0, definition_js_1.isNonNullType)(type)) {
        if (valueNode.kind === kinds_js_1.Kind.NULL) {
            return; // Invalid: intentionally return no value.
        }
        return coerceInputLiteral(valueNode, type.ofType, variableValues, fragmentVariableValues);
    }
    if (valueNode.kind === kinds_js_1.Kind.NULL) {
        return null; // Explicitly return the value null.
    }
    if ((0, definition_js_1.isListType)(type)) {
        if (valueNode.kind !== kinds_js_1.Kind.LIST) {
            // Lists accept a non-list value as a list of one.
            const itemValue = coerceInputLiteral(valueNode, type.ofType, variableValues, fragmentVariableValues);
            if (itemValue === undefined) {
                return; // Invalid: intentionally return no value.
            }
            return [itemValue];
        }
        const coercedValue = [];
        for (const itemNode of valueNode.values) {
            let itemValue = coerceInputLiteral(itemNode, type.ofType, variableValues, fragmentVariableValues);
            if (itemValue === undefined) {
                if (itemNode.kind === kinds_js_1.Kind.VARIABLE &&
                    getCoercedVariableValue(itemNode, variableValues, fragmentVariableValues) == null &&
                    !(0, definition_js_1.isNonNullType)(type.ofType)) {
                    // A missing variable within a list is coerced to null.
                    itemValue = null;
                }
                else {
                    return; // Invalid: intentionally return no value.
                }
            }
            coercedValue.push(itemValue);
        }
        return coercedValue;
    }
    if ((0, definition_js_1.isInputObjectType)(type)) {
        if (valueNode.kind !== kinds_js_1.Kind.OBJECT) {
            return; // Invalid: intentionally return no value.
        }
        const coercedValue = {};
        const fieldDefs = type.getFields();
        const hasUndefinedField = valueNode.fields.some((field) => !Object.hasOwn(fieldDefs, field.name.value));
        if (hasUndefinedField) {
            return; // Invalid: intentionally return no value.
        }
        const fieldNodes = new Map(valueNode.fields.map((field) => [field.name.value, field]));
        for (const field of Object.values(fieldDefs)) {
            const fieldNode = fieldNodes.get(field.name);
            if (!fieldNode ||
                (fieldNode.value.kind === kinds_js_1.Kind.VARIABLE &&
                    getCoercedVariableValue(fieldNode.value, variableValues, fragmentVariableValues) == null)) {
                if ((0, definition_js_1.isRequiredInputField)(field)) {
                    return; // Invalid: intentionally return no value.
                }
                if (field.defaultValue) {
                    coercedValue[field.name] = coerceDefaultValue(field.defaultValue, field.type);
                }
            }
            else {
                const fieldValue = coerceInputLiteral(fieldNode.value, field.type, variableValues, fragmentVariableValues);
                if (fieldValue === undefined) {
                    return; // Invalid: intentionally return no value.
                }
                coercedValue[field.name] = fieldValue;
            }
        }
        if (type.isOneOf) {
            const keys = Object.keys(coercedValue);
            if (keys.length !== 1) {
                return; // Invalid: not exactly one key, intentionally return no value.
            }
            if (coercedValue[keys[0]] === null) {
                return; // Invalid: value not non-null, intentionally return no value.
            }
        }
        return coercedValue;
    }
    const leafType = (0, definition_js_1.assertLeafType)(type);
    try {
        return leafType.coerceInputLiteral
            ? leafType.coerceInputLiteral((0, replaceVariables_js_1.replaceVariables)(valueNode, variableValues, fragmentVariableValues))
            : leafType.parseLiteral(valueNode, variableValues?.coerced);
    }
    catch (_error) {
        // Invalid: ignore error and intentionally return no value.
    }
}
exports.coerceInputLiteral = coerceInputLiteral;
// Retrieves the variable value for the given variable node.
function getCoercedVariableValue(variableNode, variableValues, fragmentVariableValues) {
    const varName = variableNode.name.value;
    if (fragmentVariableValues?.sources[varName] !== undefined) {
        return fragmentVariableValues.coerced[varName];
    }
    return variableValues?.coerced[varName];
}
/**
 * @internal
 */
function coerceDefaultValue(defaultValue, type) {
    // Memoize the result of coercing the default value in a hidden field.
    let coercedValue = defaultValue._memoizedCoercedValue;
    if (coercedValue === undefined) {
        coercedValue = defaultValue.literal
            ? coerceInputLiteral(defaultValue.literal, type)
            : coerceInputValue(defaultValue.value, type);
        (coercedValue !== undefined) || (0, invariant_js_1.invariant)(false);
        defaultValue._memoizedCoercedValue = coercedValue;
    }
    return coercedValue;
}
exports.coerceDefaultValue = coerceDefaultValue;
//# sourceMappingURL=coerceInputValue.js.map