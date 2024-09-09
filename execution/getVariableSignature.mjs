import { GraphQLError } from "../error/GraphQLError.mjs";
import { print } from "../language/printer.mjs";
import { isInputType } from "../type/definition.mjs";
import { typeFromAST } from "../utilities/typeFromAST.mjs";
import { valueFromAST } from "../utilities/valueFromAST.mjs";
export function getVariableSignature(schema, varDefNode) {
    const varName = varDefNode.variable.name.value;
    const varType = typeFromAST(schema, varDefNode.type);
    if (!isInputType(varType)) {
        // Must use input types for variables. This should be caught during
        // validation, however is checked again here for safety.
        const varTypeStr = print(varDefNode.type);
        return new GraphQLError(`Variable "$${varName}" expected value of type "${varTypeStr}" which cannot be used as an input type.`, { nodes: varDefNode.type });
    }
    return {
        name: varName,
        type: varType,
        defaultValue: valueFromAST(varDefNode.defaultValue, varType),
    };
}
