import { groupBy } from "../../jsutils/groupBy.mjs";
import { GraphQLError } from "../../error/GraphQLError.mjs";
/**
 * Unique variable names
 *
 * A GraphQL operation is only valid if all its variables are uniquely named.
 */
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
//# sourceMappingURL=UniqueVariableNamesRule.js.map