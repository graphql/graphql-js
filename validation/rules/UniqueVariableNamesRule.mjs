import { groupBy } from "../../jsutils/groupBy.mjs";
import { GraphQLError } from "../../error/GraphQLError.mjs";
export function UniqueVariableNamesRule(context) {
    return {
        OperationDefinition(operationNode) {
            const variableDefinitions = operationNode.variableDefinitions ?? [];
            const seenVariableDefinitions = groupBy(variableDefinitions, (node) => node.variable.name.value);
            for (const [variableName, variableNodes] of seenVariableDefinitions) {
                if (variableNodes.length > 1) {
                    context.reportError(new GraphQLError(`There can be only one variable named "$${variableName}".`, { nodes: variableNodes.map((node) => node.variable.name) }));
                }
            }
        },
    };
}
//# sourceMappingURL=UniqueVariableNamesRule.mjs.map