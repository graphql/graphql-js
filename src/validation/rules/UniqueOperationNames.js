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


export function duplicateOperationNameMessage(operationName: string): string {
  return `There can be only one operation named "${operationName}".`;
}

/**
 * Unique operation names
 *
 * A GraphQL document is only valid if all defined operations have unique names.
 */
export function UniqueOperationNames(context: ValidationContext): any {
  const knownOperationNames = Object.create(null);
  return {
    OperationDefinition(node) {
      const operationName = node.name;
      if (operationName) {
        if (knownOperationNames[operationName.value]) {
          context.reportError(new GraphQLError(
            duplicateOperationNameMessage(operationName.value),
            [ knownOperationNames[operationName.value], operationName ]
          ));
        } else {
          knownOperationNames[operationName.value] = operationName;
        }
      }
      return false;
    },
    FragmentDefinition: () => false,
  };
}
