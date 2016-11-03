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


export function undefinedVarMessage(varName: string, opName: ?string): string {
  return opName ?
    `Variable "$${varName}" is not defined by operation "${opName}".` :
    `Variable "$${varName}" is not defined.`;
}

/**
 * No undefined variables
 *
 * A GraphQL operation is only valid if all variables encountered, both directly
 * and via fragment spreads, are defined by that operation.
 */
export function NoUndefinedVariables(context: ValidationContext): any {
  let variableNameDefined = Object.create(null);

  return {
    OperationDefinition: {
      enter() {
        variableNameDefined = Object.create(null);
      },
      leave(operation) {
        const usages = context.getRecursiveVariableUsages(operation);

        usages.forEach(({ node }) => {
          const varName = node.name.value;
          if (variableNameDefined[varName] !== true) {
            context.reportError(new GraphQLError(
              undefinedVarMessage(
                varName,
                operation.name && operation.name.value
              ),
              [ node, operation ]
            ));
          }
        });
      }
    },
    VariableDefinition(node) {
      variableNameDefined[node.variable.name.value] = true;
    }
  };
}
