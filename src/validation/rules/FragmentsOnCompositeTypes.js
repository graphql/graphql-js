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
import { print } from '../../language/printer';
import { isCompositeType } from '../../type/definition';
import type { GraphQLType } from '../../type/definition';


export function inlineFragmentOnNonCompositeErrorMessage(
  type: GraphQLType
): string {
  return `Fragment cannot condition on non composite type "${String(type)}".`;
}

export function fragmentOnNonCompositeErrorMessage(
  fragName: string,
  type: GraphQLType
): string {
  return `Fragment "${fragName}" cannot condition on non composite ` +
    `type "${String(type)}".`;
}

/**
 * Fragments on composite type
 *
 * Fragments use a type condition to determine if they apply, since fragments
 * can only be spread into a composite type (object, interface, or union), the
 * type condition must also be a composite type.
 */
export function FragmentsOnCompositeTypes(context: ValidationContext): any {
  return {
    InlineFragment(node) {
      const type = context.getType();
      if (node.typeCondition && type && !isCompositeType(type)) {
        context.reportError(new GraphQLError(
          inlineFragmentOnNonCompositeErrorMessage(print(node.typeCondition)),
          [ node.typeCondition ]
        ));
      }
    },
    FragmentDefinition(node) {
      const type = context.getType();
      if (type && !isCompositeType(type)) {
        context.reportError(new GraphQLError(
          fragmentOnNonCompositeErrorMessage(
            node.name.value,
            print(node.typeCondition)
          ),
          [ node.typeCondition ]
        ));
      }
    }
  };
}
