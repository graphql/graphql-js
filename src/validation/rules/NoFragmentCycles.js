/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import type { ValidationContext } from '../index';
import { GraphQLError } from '../../error';
import { cycleErrorMessage } from '../errors';
import type { SelectionSet, FragmentSpread } from '../../language/ast';
import { FRAGMENT_DEFINITION } from '../../language/kinds';
import { visit } from '../../language/visitor';


export default function NoFragmentCycles(context: ValidationContext): any {

  // Gather all the fragment spreads ASTs for each fragment definition.
  // Importantly this does not include inline fragments.
  var definitions = context.getDocument().definitions;
  var spreadsInFragment = definitions.reduce((map, node) => {
    if (node.kind === FRAGMENT_DEFINITION) {
      map[node.name.value] = gatherSpreads(node);
    }
    return map;
  }, {});

  // Tracks spreads known to lead to cycles to ensure that cycles are not
  // redundantly reported.
  var knownToLeadToCycle = new Set();

  return {
    FragmentDefinition(node) {
      var errors = [];
      var initialName = node.name.value;

      // Array of AST nodes used to produce meaningful errors
      var spreadPath = [];

      // This does a straight-forward DFS to find cycles.
      // It does not terminate when a cycle was found but continues to explore
      // the graph to find all possible cycles.
      function detectCycleRecursive(fragmentName) {
        var spreadNodes = spreadsInFragment[fragmentName];
        for (var i = 0; i < spreadNodes.length; ++i) {
          var spreadNode = spreadNodes[i];
          if (knownToLeadToCycle.has(spreadNode)) {
            continue;
          }
          if (spreadNode.name.value === initialName) {
            var cyclePath = spreadPath.concat(spreadNode);
            cyclePath.forEach(spread => knownToLeadToCycle.add(spread));
            errors.push(new GraphQLError(
              cycleErrorMessage(initialName, spreadPath.map(s => s.name.value)),
              cyclePath
            ));
            continue;
          }
          if (spreadPath.some(spread => spread === spreadNode)) {
            continue;
          }

          spreadPath.push(spreadNode);
          detectCycleRecursive(spreadNode.name.value);
          spreadPath.pop();
        }
      }

      detectCycleRecursive(initialName);

      if (errors.length > 0) {
        return errors;
      }
    },
  };
}

/**
 * Given an operation or fragment AST node, gather all the
 * named spreads defined within the scope of the fragment
 * or operation
 */
function gatherSpreads(node: SelectionSet): Array<FragmentSpread> {
  var spreadNodes = [];
  visit(node, {
    FragmentSpread(spread) {
      spreadNodes.push(spread);
    }
  });
  return spreadNodes;
}
