import { Kind } from "../language/kinds.mjs";
export function getOperationAST(documentAST, operationName) {
    let operation = null;
    for (const definition of documentAST.definitions) {
        if (definition.kind === Kind.OPERATION_DEFINITION) {
            if (operationName == null) {
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
//# sourceMappingURL=getOperationAST.mjs.map