"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceVariables = void 0;
const kinds_js_1 = require("../language/kinds.js");
const visitor_js_1 = require("../language/visitor.js");
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
    return (0, visitor_js_1.visit)(valueNode, {
        Variable(node) {
            const varName = node.name.value;
            const scopedVariableValues = fragmentVariableValues?.sources[varName]
                ? fragmentVariableValues
                : variableValues;
            if (scopedVariableValues == null) {
                return { kind: kinds_js_1.Kind.NULL };
            }
            const scopedVariableSource = scopedVariableValues.sources[varName];
            if (scopedVariableSource.value === undefined) {
                const defaultValue = scopedVariableSource.signature.defaultValue;
                if (defaultValue !== undefined) {
                    return defaultValue.literal;
                }
            }
            return (0, valueToLiteral_js_1.valueToLiteral)(scopedVariableSource.value, scopedVariableSource.signature.type);
        },
        ObjectValue(node) {
            return {
                ...node,
                // Filter out any fields with a missing variable.
                fields: node.fields.filter((field) => {
                    if (field.value.kind !== kinds_js_1.Kind.VARIABLE) {
                        return true;
                    }
                    const scopedVariableSource = fragmentVariableValues?.sources[field.value.name.value] ??
                        variableValues?.sources[field.value.name.value];
                    if (scopedVariableSource?.value === undefined &&
                        scopedVariableSource?.signature.defaultValue === undefined) {
                        return false;
                    }
                    return true;
                }),
            };
        },
    });
}
exports.replaceVariables = replaceVariables;
