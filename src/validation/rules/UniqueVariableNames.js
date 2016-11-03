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
import type { VariableDefinitionNode } from '../../language/ast';
import { GraphQLError } from '../../error';


export function duplicateVariableMessage(variableName: string): string {
  return `There can be only one variable named "${variableName}".`;
}

/**
 * Unique variable names
 *
 * A GraphQL operation is only valid if all its variables are uniquely named.
 */
export function UniqueVariableNames(context: ValidationContext): any {
  let knownVariableNames = Object.create(null);
  return {
    OperationDefinition() {
      knownVariableNames = Object.create(null);
    },
    VariableDefinition(node: VariableDefinitionNode) {
      const variableName = node.variable.name.value;
      if (knownVariableNames[variableName]) {
        context.reportError(new GraphQLError(
          duplicateVariableMessage(variableName),
          [ knownVariableNames[variableName], node.variable.name ]
        ));
      } else {
        knownVariableNames[variableName] = node.variable.name;
      }
    }
  };
}
