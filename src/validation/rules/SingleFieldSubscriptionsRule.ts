import { GraphQLError } from '../../error/GraphQLError';

import type { ASTVisitor } from '../../language/visitor';
import type { OperationDefinitionNode } from '../../language/ast';

import type { ASTValidationContext } from '../ValidationContext';

/**
 * Subscriptions must only include a non-introspection field.
 *
 * A GraphQL subscription is valid only if it contains a single root field and
 * that root field is not an introspection field.
 */
export function SingleFieldSubscriptionsRule(
  context: ASTValidationContext,
): ASTVisitor {
  return {
    OperationDefinition(node: OperationDefinitionNode) {
      if (node.operation === 'subscription') {
        if (node.selectionSet.selections.length !== 1) {
          context.reportError(
            new GraphQLError(
              node.name
                ? `Subscription "${node.name.value}" must select only one top level field.`
                : 'Anonymous Subscription must select only one top level field.',
              node.selectionSet.selections.slice(1),
            ),
          );
        } else {
          const selection = node.selectionSet.selections[0];
          if (selection.kind === 'Field') {
            const fieldName = selection.name.value;
            // fieldName represents an introspection field if it starts with `__`
            if (fieldName[0] === '_' && fieldName[1] === '_') {
              context.reportError(
                new GraphQLError(
                  node.name
                    ? `Subscription "${node.name.value}" must not select an introspection top level field.`
                    : 'Anonymous Subscription must not select an introspection top level field.',
                  node.selectionSet.selections,
                ),
              );
            }
          }
        }
      }
    },
  };
}
