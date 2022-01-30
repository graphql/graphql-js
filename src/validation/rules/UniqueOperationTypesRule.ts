import { GraphQLError } from '../../error/GraphQLError';

import type {
  SchemaDefinitionNode,
  SchemaExtensionNode,
} from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import type { SDLValidationContext } from '../ValidationContext';

/**
 * Unique operation types
 *
 * A GraphQL document is only valid if it has only one type per operation.
 */
export function UniqueOperationTypesRule(
  context: SDLValidationContext,
): ASTVisitor {
  const schema = context.getSchema();
  const definedOperationTypes = Object.create(null);
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

  function checkOperationTypes(
    node: SchemaDefinitionNode | SchemaExtensionNode,
  ) {
    // See: https://github.com/graphql/graphql-js/issues/2203
    /* c8 ignore next */
    const operationTypesNodes = node.operationTypes ?? [];

    for (const operationType of operationTypesNodes) {
      const operation = operationType.operation;
      const alreadyDefinedOperationType = definedOperationTypes[operation];

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
        definedOperationTypes[operation] = operationType;
      }
    }

    return false;
  }
}
