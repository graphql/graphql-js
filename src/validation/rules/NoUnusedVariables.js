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


export function unusedVariableMessage(varName: any): string {
  return `Variable "$${varName}" is never used.`;
}

/**
 * No unused variables
 *
 * A GraphQL operation is only valid if all variables defined by an operation
 * are used, either directly or within a spread fragment.
 */
export function NoUnusedVariables(): any {
  var visitedFragmentNames = {};
  var variableDefs = [];
  var variableNameUsed = {};

  return {
    // Visit FragmentDefinition after visiting FragmentSpread
    visitSpreadFragments: true,

    OperationDefinition: {
      enter() {
        visitedFragmentNames = {};
        variableDefs = [];
        variableNameUsed = {};
      },
      leave() {
        var errors = variableDefs
          .filter(def => variableNameUsed[def.variable.name.value] !== true)
          .map(def => new GraphQLError(
            unusedVariableMessage(def.variable.name.value),
            [ def ]
          ));
        if (errors.length > 0) {
          return errors;
        }
      }
    },
    VariableDefinition(def) {
      variableDefs.push(def);
      // Do not visit deeper, or else the defined variable name will be visited.
      return false;
    },
    Variable(variable) {
      variableNameUsed[variable.name.value] = true;
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
