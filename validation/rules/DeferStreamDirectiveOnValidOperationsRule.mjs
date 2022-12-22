import { GraphQLError } from '../../error/GraphQLError.mjs';
import { OperationTypeNode } from '../../language/ast.mjs';
import { Kind } from '../../language/kinds.mjs';
import {
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from '../../type/directives.mjs';
function ifArgumentCanBeFalse(node) {
  const ifArgument = node.arguments?.find((arg) => arg.name.value === 'if');
  if (!ifArgument) {
    return false;
  }
  if (ifArgument.value.kind === Kind.BOOLEAN) {
    if (ifArgument.value.value) {
      return false;
    }
  } else if (ifArgument.value.kind !== Kind.VARIABLE) {
    return false;
  }
  return true;
}
/**
 * Defer And Stream Directives Are Used On Valid Operations
 *
 * A GraphQL document is only valid if defer directives are not used on root mutation or subscription types.
 */
export function DeferStreamDirectiveOnValidOperationsRule(context) {
  const fragmentsUsedOnSubscriptions = new Set();
  return {
    OperationDefinition(operation) {
      if (operation.operation === OperationTypeNode.SUBSCRIPTION) {
        for (const fragment of context.getRecursivelyReferencedFragments(
          operation,
        )) {
          fragmentsUsedOnSubscriptions.add(fragment.name.value);
        }
      }
    },
    Directive(node, _key, _parent, _path, ancestors) {
      const definitionNode = ancestors[2];
      if (
        'kind' in definitionNode &&
        ((definitionNode.kind === Kind.FRAGMENT_DEFINITION &&
          fragmentsUsedOnSubscriptions.has(definitionNode.name.value)) ||
          (definitionNode.kind === Kind.OPERATION_DEFINITION &&
            definitionNode.operation === OperationTypeNode.SUBSCRIPTION))
      ) {
        if (node.name.value === GraphQLDeferDirective.name) {
          if (!ifArgumentCanBeFalse(node)) {
            context.reportError(
              new GraphQLError(
                'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
                { nodes: node },
              ),
            );
          }
        } else if (node.name.value === GraphQLStreamDirective.name) {
          if (!ifArgumentCanBeFalse(node)) {
            context.reportError(
              new GraphQLError(
                'Stream directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
                { nodes: node },
              ),
            );
          }
        }
      }
    },
  };
}
