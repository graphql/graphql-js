"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOperationAST = getOperationAST;
const kinds_js_1 = require("../language/kinds.js");
/**
 * Returns an operation AST given a document AST and optionally an operation
 * name. If a name is not provided, an operation is only returned if only one is
 * provided in the document.
 */
function getOperationAST(documentAST, operationName) {
    let operation = null;
    for (const definition of documentAST.definitions) {
        if (definition.kind === kinds_js_1.Kind.OPERATION_DEFINITION) {
            if (operationName == null) {
                // If no operation name was provided, only return an Operation if there
                // is one defined in the document. Upon encountering the second, return
                // null.
                if (operation) {
                    return null;
                }
                operation = definition;
            }
            else if (definition.name?.value === operationName) {
                return definition;
            }
        }
    }
    return operation;
}
//# sourceMappingURL=getOperationAST.js.map