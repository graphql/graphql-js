/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { FragmentDefinitionNode } from '../../language/ast.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/** Fragment definitions must be referenced by an operation.
 * @internal
 */
export const NoUnusedFragmentsASTVisitor: ASTVisitorFn = (context) => {
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
};
