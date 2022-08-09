import { GraphQLError } from '../../error/GraphQLError.ts';
import type { FragmentDefinitionNode } from '../../language/ast.ts';
import type { ASTVisitor } from '../../language/visitor.ts';
import type { ASTValidationContext } from '../ValidationContext.ts';
/**
 * No unused fragments
 *
 * A GraphQL document is only valid if all fragment definitions are spread
 * within operations, or spread within other fragments spread within operations.
 *
 * See https://spec.graphql.org/draft/#sec-Fragments-Must-Be-Used
 */
export function NoUnusedFragmentsRule(
  context: ASTValidationContext,
): ASTVisitor {
  const fragmentNameUsed = new Set<string>();
  const fragmentDefs: Array<FragmentDefinitionNode> = [];
  return {
    OperationDefinition(operation) {
      for (const fragment of context.getRecursivelyReferencedFragments(
        operation,
      )) {
        fragmentNameUsed.add(fragment.name.value);
      }
      return false;
    },
    FragmentDefinition(node) {
      fragmentDefs.push(node);
      return false;
    },
    Document: {
      leave() {
        for (const fragmentDef of fragmentDefs) {
          const fragName = fragmentDef.name.value;
          if (!fragmentNameUsed.has(fragName)) {
            context.reportError(
              new GraphQLError(`Fragment "${fragName}" is never used.`, {
                nodes: fragmentDef,
              }),
            );
          }
        }
      },
    },
  };
}
