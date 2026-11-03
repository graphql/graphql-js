import { GraphQLError } from "../../error/GraphQLError.mjs";
export function NoUnusedVariablesRule(context) {
    return {
        FragmentDefinition(fragment) {
            const usages = context.getVariableUsages(fragment);
            const argumentNameUsed = new Set(usages.map(({ node }) => node.name.value));
            const variableDefinitions = fragment.variableDefinitions ?? [];
            for (const varDef of variableDefinitions) {
                const argName = varDef.variable.name.value;
                if (!argumentNameUsed.has(argName)) {
                    context.reportError(new GraphQLError(`Variable "$${argName}" is never used in fragment "${fragment.name.value}".`, { nodes: varDef }));
                }
            }
        },
        OperationDefinition(operation) {
            const usages = context.getRecursiveVariableUsages(operation);
            const operationVariableNameUsed = new Set();
            for (const { node, fragmentVariableDefinition } of usages) {
                const varName = node.name.value;
                if (!fragmentVariableDefinition) {
                    operationVariableNameUsed.add(varName);
                }
            }
            const variableDefinitions = operation.variableDefinitions ?? [];
            for (const variableDef of variableDefinitions) {
                const variableName = variableDef.variable.name.value;
                if (!operationVariableNameUsed.has(variableName)) {
                    context.reportError(new GraphQLError(operation.name
                        ? `Variable "$${variableName}" is never used in operation "${operation.name.value}".`
                        : `Variable "$${variableName}" is never used.`, { nodes: variableDef }));
                }
            }
        },
    };
}
//# sourceMappingURL=NoUnusedVariablesRule.mjs.map