import { GraphQLError } from '../../error/GraphQLError';

import type { ASTVisitor } from '../../language/visitor';
import type {
  OperationDefinitionNode,
  SelectionSetNode,
} from '../../language/ast';
import { Kind } from '../../language/kinds';

import type { ASTValidationContext } from '../ValidationContext';

/**
 * Walks the selection set and returns a list of selections where extra fields
 * were selected, and selections where introspection fields were selected.
 */
function walkSubscriptionSelectionSet(
  context: ASTValidationContext,
  selectionSet: SelectionSetNode,
  responseKeys,
  fieldNames = new Set(),
  visitedFragmentNames = new Set(),
  extraFieldSelections = [],
  introspectionFieldSelections = [],
) {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        const fieldName = selection.name.value;
        fieldNames.add(fieldName);
        const responseName = selection.alias
          ? selection.alias.value
          : fieldName;
        responseKeys.add(responseName);
        if (fieldName[0] === '_' && fieldName[1] === '_') {
          // fieldName represents an introspection field if it starts with `__`
          introspectionFieldSelections.push(selection);
        } else if (fieldNames.size > 1 || responseKeys.size > 1) {
          extraFieldSelections.push(selection);
        }
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragmentName = selection.name.value;
        if (!visitedFragmentNames.has(fragmentName)) {
          visitedFragmentNames.add(fragmentName);
          const fragment = context.getFragment(fragmentName);
          if (fragment) {
            walkSubscriptionSelectionSet(
              context,
              fragment.selectionSet,
              responseKeys,
              fieldNames,
              visitedFragmentNames,
              extraFieldSelections,
              introspectionFieldSelections,
            );
          }
        }
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        walkSubscriptionSelectionSet(
          context,
          selection.selectionSet,
          responseKeys,
          fieldNames,
          visitedFragmentNames,
          extraFieldSelections,
          introspectionFieldSelections,
        );
        break;
      }
    }
  }
  return [extraFieldSelections, introspectionFieldSelections];
}

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
        const responseKeys = new Set();
        const operationName = node.name ? node.name.value : null;
        const [
          extraFieldSelections,
          introspectionFieldSelections,
        ] = walkSubscriptionSelectionSet(
          context,
          node.selectionSet,
          responseKeys,
        );
        if (extraFieldSelections.length > 0) {
          context.reportError(
            new GraphQLError(
              operationName != null
                ? `Subscription "${operationName}" must select only one top level field.`
                : 'Anonymous Subscription must select only one top level field.',
              extraFieldSelections,
            ),
          );
        }
        if (introspectionFieldSelections.length > 0) {
          context.reportError(
            new GraphQLError(
              operationName != null
                ? `Subscription "${operationName}" must not select an introspection top level field.`
                : 'Anonymous Subscription must not select an introspection top level field.',
              introspectionFieldSelections,
            ),
          );
        }
      }
    },
  };
}
