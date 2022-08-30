import type { ObjMap } from '../../jsutils/ObjMap.js';

import { GraphQLError } from '../../error/GraphQLError.js';

import type {
  FragmentDefinitionNode,
  FragmentSpreadNode,
} from '../../language/ast.js';
import type { ASTVisitor } from '../../language/visitor.js';

import type { ASTValidationContext } from '../ValidationContext.js';

/**
 * No fragment cycles
 *
 * The graph of fragment spreads must not form any cycles including spreading itself.
 * Otherwise an operation could infinitely spread or infinitely execute on cycles in the underlying data.
 *
 * See https://spec.graphql.org/draft/#sec-Fragment-spreads-must-not-form-cycles
 */
export function NoFragmentCyclesRule(
  context: ASTValidationContext,
): ASTVisitor {
  // Tracks already visited fragments to maintain O(N) and to ensure that cycles
  // are not redundantly reported.
  const visitedFrags = new Set<string>();

  // Array of AST nodes used to produce meaningful errors
  const spreadPath: Array<FragmentSpreadNode> = [];

  // Position in the spread path
  const spreadPathIndexByName: ObjMap<number | undefined> = Object.create(null);

  return {
    OperationDefinition: () => false,
    FragmentDefinition(node) {
      detectCycleRecursive(node);
      return false;
    },
  };

  // This does a straight-forward DFS to find cycles.
  // It does not terminate when a cycle was found but continues to explore
  // the graph to find all possible cycles.
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
        if (spreadFragment) {
          detectCycleRecursive(spreadFragment);
        }
      } else {
        const cyclePath = spreadPath.slice(cycleIndex);
        const viaPath = cyclePath
          .slice(0, -1)
          .map((s) => '"' + s.name.value + '"')
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
}
