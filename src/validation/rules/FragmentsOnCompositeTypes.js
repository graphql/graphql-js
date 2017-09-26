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
import { print } from '../../language/printer';
import { isCompositeType } from '../../type/definition';
import type { GraphQLType } from '../../type/definition';
import { typeFromAST } from '../../utilities/typeFromAST';


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
      if (node.typeCondition) {
        const type = typeFromAST(context.getSchema(), node.typeCondition);
        if (type && !isCompositeType(type)) {
          context.reportError(new GraphQLError(
            inlineFragmentOnNonCompositeErrorMessage(print(node.typeCondition)),
            [ node.typeCondition ]
          ));
        }
      }
    },
    FragmentDefinition(node) {
      const type = typeFromAST(context.getSchema(), node.typeCondition);
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
