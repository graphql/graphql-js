import { GraphQLError } from "../../error/GraphQLError.mjs";
export function KnownOperationTypesRule(context) {
    const schema = context.getSchema();
    return {
        OperationDefinition(node) {
            const operation = node.operation;
            if (!schema.getRootType(operation)) {
                context.reportError(new GraphQLError(`The ${operation} operation is not supported by the schema.`, { nodes: node }));
            }
        },
    };
}
//# sourceMappingURL=KnownOperationTypesRule.mjs.map