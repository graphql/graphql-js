import { GraphQLError } from '../../error/GraphQLError.mjs';
/**
 * Unique operation types
 *
 * A GraphQL document is only valid if it has only one type per operation.
 */
export function UniqueOperationTypesRule(context) {
  const schema = context.getSchema();
  const definedOperationTypes = new Map();
  const existingOperationTypes = schema
    ? {
        query: schema.getQueryType(),
        mutation: schema.getMutationType(),
        subscription: schema.getSubscriptionType(),
      }
    : {};
  return {
    SchemaDefinition: checkOperationTypes,
    SchemaExtension: checkOperationTypes,
  };
  function checkOperationTypes(node) {
    // See: https://github.com/graphql/graphql-js/issues/2203
    /* c8 ignore next */
    const operationTypesNodes = node.operationTypes ?? [];
    for (const operationType of operationTypesNodes) {
      const operation = operationType.operation;
      const alreadyDefinedOperationType = definedOperationTypes.get(operation);
      if (existingOperationTypes[operation]) {
        context.reportError(
          new GraphQLError(
            `Type for ${operation} already defined in the schema. It cannot be redefined.`,
            { nodes: operationType },
          ),
        );
      } else if (alreadyDefinedOperationType) {
        context.reportError(
          new GraphQLError(
            `There can be only one ${operation} type in schema.`,
            { nodes: [alreadyDefinedOperationType, operationType] },
          ),
        );
      } else {
        definedOperationTypes.set(operation, operationType);
      }
    }
    return false;
  }
}
