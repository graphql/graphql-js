import { GraphQLError } from '../../error/GraphQLError.js';

import type { ASTVisitor } from '../../language/visitor.js';

import type { ValidationContext } from '../ValidationContext.js';

/**
 * Known Operation Types
 *
 * A GraphQL document is only valid if when it contains an operation,
 * the root type for the operation exists within the schema.
 *
 * See https://spec.graphql.org/draft/#sec-Operation-Type-Existence
 */
export function KnownOperationTypesRule(
  context: ValidationContext,
): ASTVisitor {
  const schema = context.getSchema();
  return {
    OperationDefinition(node) {
      const operation = node.operation;
      if (!schema.getRootType(operation)) {
        context.reportError(
          new GraphQLError(
            `The ${operation} operation is not supported by the schema.`,
            { nodes: node },
          ),
        );
      }
    },
  };
}
