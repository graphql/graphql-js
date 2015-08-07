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
import { duplicateOperationNameMessage } from '../errors';


/**
 * Unique operation names
 *
 * A GraphQL document is only valid if all defined operations have unique names.
 */
export default function UniqueOperationNames(): any {
  var knownOperationNames = Object.create(null);
  return {
    OperationDefinition(node) {
      var operationName = node.name;
      if (operationName) {
        if (knownOperationNames[operationName.value]) {
          return new GraphQLError(
            duplicateOperationNameMessage(operationName.value),
            [knownOperationNames[operationName.value], operationName]
          );
        }
        knownOperationNames[operationName.value] = operationName;
      }
    }
  };
}
