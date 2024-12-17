"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultValueAST = void 0;
const invariant_js_1 = require("../jsutils/invariant.js");
const astFromValue_js_1 = require("./astFromValue.js");
const valueToLiteral_js_1 = require("./valueToLiteral.js");
function getDefaultValueAST(argOrInputField) {
    const type = argOrInputField.type;
    const defaultInput = argOrInputField.default;
    if (defaultInput) {
        const literal = defaultInput.literal ?? (0, valueToLiteral_js_1.valueToLiteral)(defaultInput.value, type);
        (literal != null) || (0, invariant_js_1.invariant)(false, 'Invalid default value');
        return literal;
    }
    const defaultValue = argOrInputField.defaultValue;
    if (defaultValue !== undefined) {
        const valueAST = (0, astFromValue_js_1.astFromValue)(defaultValue, type);
        (valueAST != null) || (0, invariant_js_1.invariant)(false, 'Invalid default value');
        return valueAST;
    }
    return undefined;
}
exports.getDefaultValueAST = getDefaultValueAST;
//# sourceMappingURL=getDefaultValueAST.js.map