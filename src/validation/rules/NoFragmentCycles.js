/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { ValidationContext } from '../index';
import { GraphQLError } from '../../error';
import type { FragmentDefinitionNode } from '../../language/ast';


export function cycleErrorMessage(
  fragName: string,
  spreadNames: Array<string>
): string {
  const via = spreadNames.length ? ' via ' + spreadNames.join(', ') : '';
  return `Cannot spread fragment "${fragName}" within itself${via}.`;
}

export function NoFragmentCycles(context: ValidationContext): any {
  // Tracks already visited fragments to maintain O(N) and to ensure that cycles
  // are not redundantly reported.
  const visitedFrags = Object.create(null);

  // Array of AST nodes used to produce meaningful errors
  const spreadPath = [];

  // Position in the spread path
  const spreadPathIndexByName = Object.create(null);

  return {
    OperationDefinition: () => false,
    FragmentDefinition(node) {
      if (!visitedFrags[node.name.value]) {
        detectCycleRecursive(node);
      }
      return false;
    },
  };

  // This does a straight-forward DFS to find cycles.
  // It does not terminate when a cycle was found but continues to explore
  // the graph to find all possible cycles.
  function detectCycleRecursive(fragment: FragmentDefinitionNode) {
    const fragmentName = fragment.name.value;
    visitedFrags[fragmentName] = true;

    const spreadNodes = context.getFragmentSpreads(fragment.selectionSet);
    if (spreadNodes.length === 0) {
      return;
    }

    spreadPathIndexByName[fragmentName] = spreadPath.length;

    for (let i = 0; i < spreadNodes.length; i++) {
      const spreadNode = spreadNodes[i];
      const spreadName = spreadNode.name.value;
      const cycleIndex = spreadPathIndexByName[spreadName];

      if (cycleIndex === undefined) {
        spreadPath.push(spreadNode);
        if (!visitedFrags[spreadName]) {
          const spreadFragment = context.getFragment(spreadName);
          if (spreadFragment) {
            detectCycleRecursive(spreadFragment);
          }
        }
        spreadPath.pop();
      } else {
        const cyclePath = spreadPath.slice(cycleIndex);
        context.reportError(new GraphQLError(
          cycleErrorMessage(
            spreadName,
            cyclePath.map(s => s.name.value)
          ),
          cyclePath.concat(spreadNode)
        ));
      }
    }

    spreadPathIndexByName[fragmentName] = undefined;
  }
}
