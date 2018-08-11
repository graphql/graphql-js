"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.cycleErrorMessage = cycleErrorMessage;
exports.NoFragmentCycles = NoFragmentCycles;

var _GraphQLError = require("../../error/GraphQLError");

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */
function cycleErrorMessage(fragName, spreadNames) {
  var via = spreadNames.length ? ' via ' + spreadNames.join(', ') : '';
  return "Cannot spread fragment \"".concat(fragName, "\" within itself").concat(via, ".");
}

function NoFragmentCycles(context) {
  // Tracks already visited fragments to maintain O(N) and to ensure that cycles
  // are not redundantly reported.
  var visitedFrags = Object.create(null); // Array of AST nodes used to produce meaningful errors

  var spreadPath = []; // Position in the spread path

  var spreadPathIndexByName = Object.create(null);
  return {
    OperationDefinition: function OperationDefinition() {
      return false;
    },
    FragmentDefinition: function FragmentDefinition(node) {
      detectCycleRecursive(node);
      return false;
    }
  }; // This does a straight-forward DFS to find cycles.
  // It does not terminate when a cycle was found but continues to explore
  // the graph to find all possible cycles.

  function detectCycleRecursive(fragment) {
    if (visitedFrags[fragment.name.value]) {
      return;
    }

    var fragmentName = fragment.name.value;
    visitedFrags[fragmentName] = true;
    var spreadNodes = context.getFragmentSpreads(fragment.selectionSet);

    if (spreadNodes.length === 0) {
      return;
    }

    spreadPathIndexByName[fragmentName] = spreadPath.length;

    for (var i = 0; i < spreadNodes.length; i++) {
      var spreadNode = spreadNodes[i];
      var spreadName = spreadNode.name.value;
      var cycleIndex = spreadPathIndexByName[spreadName];
      spreadPath.push(spreadNode);

      if (cycleIndex === undefined) {
        var spreadFragment = context.getFragment(spreadName);

        if (spreadFragment) {
          detectCycleRecursive(spreadFragment);
        }
      } else {
        var cyclePath = spreadPath.slice(cycleIndex);
        var fragmentNames = cyclePath.slice(0, -1).map(function (s) {
          return s.name.value;
        });
        context.reportError(new _GraphQLError.GraphQLError(cycleErrorMessage(spreadName, fragmentNames), cyclePath));
      }

      spreadPath.pop();
    }

    spreadPathIndexByName[fragmentName] = undefined;
  }
}