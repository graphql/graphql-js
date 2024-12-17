import { invariant } from "../jsutils/invariant.mjs";
import { astFromValue } from "./astFromValue.mjs";
import { valueToLiteral } from "./valueToLiteral.mjs";
export function getDefaultValueAST(argOrInputField) {
    const type = argOrInputField.type;
    const defaultInput = argOrInputField.default;
    if (defaultInput) {
        const literal = defaultInput.literal ?? valueToLiteral(defaultInput.value, type);
        (literal != null) || invariant(false, 'Invalid default value');
        return literal;
    }
    const defaultValue = argOrInputField.defaultValue;
    if (defaultValue !== undefined) {
        const valueAST = astFromValue(defaultValue, type);
        (valueAST != null) || invariant(false, 'Invalid default value');
        return valueAST;
    }
    return undefined;
}
//# sourceMappingURL=getDefaultValueAST.js.map