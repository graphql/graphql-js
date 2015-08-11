/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { GraphQLError } from '../../error';
import { FRAGMENT_DEFINITION } from '../../language/kinds';


export function undefinedVarMessage(varName: any): string {
  return `Variable "$${varName}" is not defined.`;
}

export function undefinedVarByOpMessage(varName: any, opName: any): string {
  return `Variable "$${varName}" is not defined by operation "${opName}".`;
}

/**
 * No undefined variables
 *
 * A GraphQL operation is only valid if all variables encountered, both directly
 * and via fragment spreads, are defined by that operation.
 */
export function NoUndefinedVariables(): any {
  var operation;
  var visitedFragmentNames = {};
  var definedVariableNames = {};

  return {
    // Visit FragmentDefinition after visiting FragmentSpread
    visitSpreadFragments: true,

    OperationDefinition(node) {
      operation = node;
      visitedFragmentNames = {};
      definedVariableNames = {};
    },
    VariableDefinition(def) {
      definedVariableNames[def.variable.name.value] = true;
    },
    Variable(variable, key, parent, path, ancestors) {
      var varName = variable.name.value;
      if (definedVariableNames[varName] !== true) {
        var withinFragment = ancestors.some(
          node => node.kind === FRAGMENT_DEFINITION
        );
        if (withinFragment && operation && operation.name) {
          return new GraphQLError(
            undefinedVarByOpMessage(varName, operation.name.value),
            [ variable, operation ]
          );
        }
        return new GraphQLError(
          undefinedVarMessage(varName),
          [ variable ]
        );
      }
    },
    FragmentSpread(spreadAST) {
      // Only visit fragments of a particular name once per operation
      if (visitedFragmentNames[spreadAST.name.value] === true) {
        return false;
      }
      visitedFragmentNames[spreadAST.name.value] = true;
    }
  };
}
