import { GraphQLError } from '../../error/GraphQLError.js';

import type { NameNode } from '../../language/ast.js';
import type { ASTVisitor } from '../../language/visitor.js';

import type { ASTValidationContext } from '../ValidationContext.js';

/**
 * Unique operation names
 *
 * A GraphQL document is only valid if all defined operations have unique names.
 *
 * See https://spec.graphql.org/draft/#sec-Operation-Name-Uniqueness
 */
export function UniqueOperationNamesRule(
  context: ASTValidationContext,
): ASTVisitor {
  const knownOperationNames = new Map<string, NameNode>();
  return {
    OperationDefinition(node) {
      const operationName = node.name;
      if (operationName != null) {
        const knownOperationName = knownOperationNames.get(operationName.value);
        if (knownOperationName != null) {
          context.reportError(
            new GraphQLError(
              `There can be only one operation named "${operationName.value}".`,
              { nodes: [knownOperationName, operationName] },
            ),
          );
        } else {
          knownOperationNames.set(operationName.value, operationName);
        }
      }
      return false;
    },
    FragmentDefinition: () => false,
  };
}
