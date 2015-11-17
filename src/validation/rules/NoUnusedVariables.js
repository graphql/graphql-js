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


export function unusedVariableMessage(varName: any): string {
  return `Variable "$${varName}" is never used.`;
}

/**
 * No unused variables
 *
 * A GraphQL operation is only valid if all variables defined by an operation
 * are used, either directly or within a spread fragment.
 */
export function NoUnusedVariables(context: ValidationContext): any {
  let variableDefs = [];

  return {
    OperationDefinition: {
      enter() {
        variableDefs = [];
      },
      leave(operation) {

        const variableNameUsed = Object.create(null);
        const usages = context.getRecursiveVariableUsages(operation);

        usages.forEach(({ node }) => {
          variableNameUsed[node.name.value] = true;
        });

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
    }
  };
}
