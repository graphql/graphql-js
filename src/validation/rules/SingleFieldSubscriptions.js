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
import type { OperationDefinitionNode } from '../../language/ast';


export function singleFieldOnlyMessage(name: ?string): string {
  return (name ? `Subscription "${name}" ` : 'Anonymous Subscription ') +
    'must select only one top level field.';
}

/**
 * Subscriptions must only include one field.
 *
 * A GraphQL subscription is valid only if it contains a single root field.
 */
export function SingleFieldSubscriptions(context: ValidationContext): any {
  return {
    OperationDefinition(node: OperationDefinitionNode) {
      if (node.operation === 'subscription') {
        if (node.selectionSet.selections.length !== 1) {
          context.reportError(new GraphQLError(
            singleFieldOnlyMessage(node.name && node.name.value),
            node.selectionSet.selections.slice(1)
          ));
        }
      }
    }
  };
}
