import { Kind } from "../language/kinds.mjs";
import { visit } from "../language/visitor.mjs";
import { valueToLiteral } from "./valueToLiteral.mjs";
/**
 * Replaces any Variables found within an AST Value literal with literals
 * supplied from a map of variable values, or removed if no variable replacement
 * exists, returning a constant value.
 *
 * Used primarily to ensure only complete constant values are used during input
 * coercion of custom scalars which accept complex literals.
 */
export function replaceVariables(valueNode, variableValues, fragmentVariableValues) {
    return visit(valueNode, {
        Variable(node) {
            const varName = node.name.value;
            const scopedVariableValues = fragmentVariableValues?.sources[varName]
                ? fragmentVariableValues
                : variableValues;
            if (scopedVariableValues == null) {
                return { kind: Kind.NULL };
            }
            const scopedVariableSource = scopedVariableValues.sources[varName];
            if (scopedVariableSource.value === undefined) {
                const defaultValue = scopedVariableSource.signature.defaultValue;
                if (defaultValue !== undefined) {
                    return defaultValue.literal;
                }
            }
            return valueToLiteral(scopedVariableSource.value, scopedVariableSource.signature.type);
        },
        ObjectValue(node) {
            return {
                ...node,
                // Filter out any fields with a missing variable.
                fields: node.fields.filter((field) => {
                    if (field.value.kind !== Kind.VARIABLE) {
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
