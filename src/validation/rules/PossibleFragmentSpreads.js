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
import { doTypesOverlap } from '../../utilities/typeComparators';
import { typeFromAST } from '../../utilities/typeFromAST';
import { isCompositeType } from '../../type/definition';
import type { GraphQLType } from '../../type/definition';


export function typeIncompatibleSpreadMessage(
  fragName: string,
  parentType: GraphQLType,
  fragType: GraphQLType
): string {
  return `Fragment "${fragName}" cannot be spread here as objects of ` +
    `type "${String(parentType)}" can never be of type "${String(fragType)}".`;
}

export function typeIncompatibleAnonSpreadMessage(
  parentType: GraphQLType,
  fragType: GraphQLType
): string {
  return 'Fragment cannot be spread here as objects of ' +
    `type "${String(parentType)}" can never be of type "${String(fragType)}".`;
}

/**
 * Possible fragment spread
 *
 * A fragment spread is only valid if the type condition could ever possibly
 * be true: if there is a non-empty intersection of the possible parent types,
 * and possible types which pass the type condition.
 */
export function PossibleFragmentSpreads(context: ValidationContext): any {
  return {
    InlineFragment(node) {
      const fragType = context.getType();
      const parentType = context.getParentType();
      if (isCompositeType(fragType) &&
          isCompositeType(parentType) &&
          !doTypesOverlap(context.getSchema(), fragType, parentType)) {
        context.reportError(new GraphQLError(
          typeIncompatibleAnonSpreadMessage(parentType, fragType),
          [ node ]
        ));
      }
    },
    FragmentSpread(node) {
      const fragName = node.name.value;
      const fragType = getFragmentType(context, fragName);
      const parentType = context.getParentType();
      if (fragType &&
          parentType &&
          !doTypesOverlap(context.getSchema(), fragType, parentType)) {
        context.reportError(new GraphQLError(
          typeIncompatibleSpreadMessage(fragName, parentType, fragType),
          [ node ]
        ));
      }
    }
  };
}

function getFragmentType(context, name) {
  const frag = context.getFragment(name);
  return frag && typeFromAST(context.getSchema(), frag.typeCondition);
}
