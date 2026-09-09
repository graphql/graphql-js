/** @category Validation Rules */

import type { ObjMap } from '../../jsutils/ObjMap.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  FragmentDefinitionNode,
  FragmentSpreadNode,
} from '../../language/ast.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/** Fragment spreads must not form cycles.
 * @internal
 */
export const NoFragmentCyclesASTVisitor: ASTVisitorFn = (context) => {
  const visitedFrags = new Set<string>();
  const spreadPath: Array<FragmentSpreadNode> = [];
  const spreadPathIndexByName: ObjMap<number | undefined> = Object.create(null);

  return {
    OperationDefinition: () => false,
    FragmentDefinition(node) {
      detectCycleRecursive(node);
      return false;
    },
  };

  function detectCycleRecursive(fragment: FragmentDefinitionNode): void {
    if (visitedFrags.has(fragment.name.value)) {
      return;
    }

    const fragmentName = fragment.name.value;
    visitedFrags.add(fragmentName);

    const spreadNodes = context.getFragmentSpreads(fragment.selectionSet);
    if (spreadNodes.length === 0) {
      return;
    }

    spreadPathIndexByName[fragmentName] = spreadPath.length;

    for (const spreadNode of spreadNodes) {
      const spreadName = spreadNode.name.value;
      const cycleIndex = spreadPathIndexByName[spreadName];

      spreadPath.push(spreadNode);
      if (cycleIndex === undefined) {
        const spreadFragment = context.getFragment(spreadName);
        if (spreadFragment != null) {
          detectCycleRecursive(spreadFragment);
        }
      } else {
        const cyclePath = spreadPath.slice(cycleIndex);
        const viaPath = cyclePath
          .slice(0, -1)
          .map((s) => `"${s.name.value}"`)
          .join(', ');

        context.reportError(
          new GraphQLError(
            `Cannot spread fragment "${spreadName}" within itself` +
              (viaPath !== '' ? ` via ${viaPath}.` : '.'),
            { nodes: cyclePath },
          ),
        );
      }
      spreadPath.pop();
    }

    spreadPathIndexByName[fragmentName] = undefined;
  }
};
