import { GraphQLError } from "../../error/GraphQLError.mjs";
import { print } from "../../language/printer.mjs";
import { isInputType } from "../../type/definition.mjs";
import { typeFromAST } from "../../utilities/typeFromAST.mjs";
export function VariablesAreInputTypesRule(context) {
    return {
        VariableDefinition(node) {
            const type = typeFromAST(context.getSchema(), node.type);
            if (type !== undefined && !isInputType(type)) {
                const variableName = node.variable.name.value;
                const typeName = print(node.type);
                context.reportError(new GraphQLError(`Variable "$${variableName}" cannot be non-input type "${typeName}".`, { nodes: node.type }));
            }
        },
    };
}
//# sourceMappingURL=VariablesAreInputTypesRule.mjs.map