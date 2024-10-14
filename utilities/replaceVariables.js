"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceVariables = void 0;
const kinds_js_1 = require("../language/kinds.js");
const valueToLiteral_js_1 = require("./valueToLiteral.js");
/**
 * Replaces any Variables found within an AST Value literal with literals
 * supplied from a map of variable values, or removed if no variable replacement
 * exists, returning a constant value.
 *
 * Used primarily to ensure only complete constant values are used during input
 * coercion of custom scalars which accept complex literals.
 */
function replaceVariables(valueNode, variableValues, fragmentVariableValues) {
    switch (valueNode.kind) {
        case kinds_js_1.Kind.VARIABLE: {
            const varName = valueNode.name.value;
            const scopedVariableValues = fragmentVariableValues?.sources[varName]
                ? fragmentVariableValues
                : variableValues;
            const scopedVariableSource = scopedVariableValues?.sources[varName];
            if (scopedVariableSource == null) {
                return { kind: kinds_js_1.Kind.NULL };
            }
            if (scopedVariableSource.value === undefined) {
                const defaultValue = scopedVariableSource.signature.defaultValue;
                if (defaultValue !== undefined) {
                    return defaultValue.literal;
                }
            }
            return (0, valueToLiteral_js_1.valueToLiteral)(scopedVariableSource.value, scopedVariableSource.signature.type);
        }
        case kinds_js_1.Kind.OBJECT: {
            const newFields = [];
            for (const field of valueNode.fields) {
                if (field.value.kind === kinds_js_1.Kind.VARIABLE) {
                    const scopedVariableSource = fragmentVariableValues?.sources[field.value.name.value] ??
                        variableValues?.sources[field.value.name.value];
                    if (scopedVariableSource?.value === undefined &&
                        scopedVariableSource?.signature.defaultValue === undefined) {
                        continue;
                    }
                }
                const newFieldNodeValue = replaceVariables(field.value, variableValues, fragmentVariableValues);
                newFields.push({
                    ...field,
                    value: newFieldNodeValue,
                });
            }
            return {
                ...valueNode,
                fields: newFields,
            };
        }
        case kinds_js_1.Kind.LIST: {
            const newValues = [];
            for (const value of valueNode.values) {
                const newItemNodeValue = replaceVariables(value, variableValues, fragmentVariableValues);
                newValues.push(newItemNodeValue);
            }
            return {
                ...valueNode,
                values: newValues,
            };
        }
        default: {
            return valueNode;
        }
    }
}
exports.replaceVariables = replaceVariables;
//# sourceMappingURL=replaceVariables.js.map