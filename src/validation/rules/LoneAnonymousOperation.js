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


export function anonOperationNotAloneMessage(): string {
  return `This anonymous operation must be the only defined operation.`;
}

/**
 * Lone anonymous operation
 *
 * A GraphQL document is only valid if when it contains an anonymous operation
 * (the query short-hand) that it contains only that one operation definition.
 */
export function LoneAnonymousOperation(): any {
  var operationCount = 0;
  return {
    RequestDocument(node) {
      operationCount = node.definitions.filter(
        definition => definition.kind === 'OperationDefinition'
      ).length;
    },
    OperationDefinition(node) {
      if (!node.name && operationCount > 1) {
        return new GraphQLError(anonOperationNotAloneMessage(), [ node ]);
      }
    }
  };
}
