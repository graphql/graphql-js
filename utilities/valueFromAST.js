"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.valueFromAST = valueFromAST;
const inspect_ts_1 = require("../jsutils/inspect.js");
const invariant_ts_1 = require("../jsutils/invariant.js");
const kinds_ts_1 = require("../language/kinds.js");
const definition_ts_1 = require("../type/definition.js");
function valueFromAST(valueNode, type, variables) {
    if (!valueNode) {
        return;
    }
    if (valueNode.kind === kinds_ts_1.Kind.VARIABLE) {
        const variableName = valueNode.name.value;
        if (variables == null || !Object.hasOwn(variables, variableName)) {
            return;
        }
        const variableValue = variables[variableName];
        if (variableValue === undefined) {
            return;
        }
        if (variableValue === null && (0, definition_ts_1.isNonNullType)(type)) {
            return;
        }
        return variableValue;
    }
    if ((0, definition_ts_1.isNonNullType)(type)) {
        if (valueNode.kind === kinds_ts_1.Kind.NULL) {
            return;
        }
        return valueFromAST(valueNode, type.ofType, variables);
    }
    if (valueNode.kind === kinds_ts_1.Kind.NULL) {
        return null;
    }
    if ((0, definition_ts_1.isListType)(type)) {
        const itemType = type.ofType;
        if (valueNode.kind === kinds_ts_1.Kind.LIST) {
            const coercedValues = [];
            for (const itemNode of valueNode.values) {
                if (isMissingVariable(itemNode, variables)) {
                    if ((0, definition_ts_1.isNonNullType)(itemType)) {
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
    if ((0, definition_ts_1.isInputObjectType)(type)) {
        if (valueNode.kind !== kinds_ts_1.Kind.OBJECT) {
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
                else if ((0, definition_ts_1.isNonNullType)(field.type)) {
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
                if (fieldNode.value.kind === kinds_ts_1.Kind.NULL ||
                    coercedObj[fieldName] === null) {
                    return;
                }
            }
        }
        return coercedObj;
    }
    if ((0, definition_ts_1.isLeafType)(type)) {
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
    (0, invariant_ts_1.invariant)(false, 'Unexpected input type: ' + (0, inspect_ts_1.inspect)(type));
}
function isMissingVariable(valueNode, variables) {
    return (valueNode.kind === kinds_ts_1.Kind.VARIABLE &&
        (variables == null ||
            !Object.hasOwn(variables, valueNode.name.value) ||
            variables[valueNode.name.value] === undefined));
}
//# sourceMappingURL=valueFromAST.js.map