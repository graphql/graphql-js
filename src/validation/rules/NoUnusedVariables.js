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


export function unusedVariableMessage(
  varName: string,
  opName: ?string
): string {
  return opName ?
    `Variable "$${varName}" is never used in operation "${opName}".` :
    `Variable "$${varName}" is never used.`;
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
        const opName = operation.name ? operation.name.value : null;

        usages.forEach(({ node }) => {
          variableNameUsed[node.name.value] = true;
        });

        variableDefs.forEach(variableDef => {
          const variableName = variableDef.variable.name.value;
          if (variableNameUsed[variableName] !== true) {
            context.reportError(new GraphQLError(
              unusedVariableMessage(variableName, opName),
              [ variableDef ]
            ));
          }
        });
      }
    },
    VariableDefinition(def) {
      variableDefs.push(def);
    }
  };
}
