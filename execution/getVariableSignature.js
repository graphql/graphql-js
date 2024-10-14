"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVariableSignature = void 0;
const GraphQLError_js_1 = require("../error/GraphQLError.js");
const printer_js_1 = require("../language/printer.js");
const definition_js_1 = require("../type/definition.js");
const typeFromAST_js_1 = require("../utilities/typeFromAST.js");
function getVariableSignature(schema, varDefNode) {
    const varName = varDefNode.variable.name.value;
    const varType = (0, typeFromAST_js_1.typeFromAST)(schema, varDefNode.type);
    if (!(0, definition_js_1.isInputType)(varType)) {
        // Must use input types for variables. This should be caught during
        // validation, however is checked again here for safety.
        const varTypeStr = (0, printer_js_1.print)(varDefNode.type);
        return new GraphQLError_js_1.GraphQLError(`Variable "$${varName}" expected value of type "${varTypeStr}" which cannot be used as an input type.`, { nodes: varDefNode.type });
    }
    const defaultValue = varDefNode.defaultValue;
    return {
        name: varName,
        type: varType,
        defaultValue: defaultValue ? { literal: defaultValue } : undefined,
    };
}
exports.getVariableSignature = getVariableSignature;
//# sourceMappingURL=getVariableSignature.js.map