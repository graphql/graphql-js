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
import type { Field } from '../../language/ast';
import { isLeafType } from '../../type/definition';
import type { GraphQLType } from '../../type/definition';


export function noSubselectionAllowedMessage(
  field: string,
  type: GraphQLType
): string {
  return `Field "${field}" of type "${type}" must not have a sub selection.`;
}

export function requiredSubselectionMessage(
  field: string,
  type: GraphQLType
): string {
  return `Field "${field}" of type "${type}" must have a sub selection.`;
}

/**
 * Scalar leafs
 *
 * A GraphQL document is valid only if all leaf fields (fields without
 * sub selections) are of scalar or enum types.
 */
export function ScalarLeafs(context: ValidationContext): any {
  return {
    Field(node: Field) {
      const type = context.getType();
      if (type) {
        if (isLeafType(type)) {
          if (node.selectionSet) {
            context.reportError(new GraphQLError(
              noSubselectionAllowedMessage(node.name.value, type),
              [ node.selectionSet ]
            ));
          }
        } else if (!node.selectionSet) {
          context.reportError(new GraphQLError(
            requiredSubselectionMessage(node.name.value, type),
            [ node ]
          ));
        }
      }
    }
  };
}
