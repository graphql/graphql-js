import { invariant } from "../jsutils/invariant.mjs";
import { OperationTypeNode } from "../language/ast.mjs";
import { GraphQLStreamDirective } from "../type/directives.mjs";
import { getDirectiveValues } from "./values.mjs";
export function getStreamUsage(validatedExecutionArgs, fieldDetailsList) {
    const { operation, variableValues } = validatedExecutionArgs;
    const stream = getDirectiveValues(GraphQLStreamDirective, fieldDetailsList[0].node, variableValues, fieldDetailsList[0].fragmentVariableValues);
    if (!stream) {
        return;
    }
    if (stream.if === false) {
        return;
    }
    if (!(typeof stream.initialCount === 'number'))
        invariant(false, 'initialCount must be a number');
    if (!(stream.initialCount >= 0))
        invariant(false, 'initialCount must be a positive integer');
    if (!(operation.operation !== OperationTypeNode.SUBSCRIPTION))
        invariant(false, '`@stream` directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.');
    const streamedFieldDetailsList = fieldDetailsList.map((fieldDetails) => ({
        node: fieldDetails.node,
        deferUsage: undefined,
        fragmentVariableValues: fieldDetails.fragmentVariableValues,
    }));
    return {
        initialCount: stream.initialCount,
        label: typeof stream.label === 'string' ? stream.label : undefined,
        fieldDetailsList: streamedFieldDetailsList,
    };
}
//# sourceMappingURL=getStreamUsage.mjs.map