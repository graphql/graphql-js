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
import keyMap from '../../jsutils/keyMap';
import {
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType
} from '../../type/definition';
import { typeFromAST } from '../../utilities/typeFromAST';


export function typeIncompatibleSpreadMessage(
  fragName: any,
  parentType: any,
  fragType: any
): string {
  return `Fragment "${fragName}" cannot be spread here as objects of ` +
    `type "${parentType}" can never be of type "${fragType}".`;
}

export function typeIncompatibleAnonSpreadMessage(
  parentType: any,
  fragType: any
): string {
  return `Fragment cannot be spread here as objects of ` +
    `type "${parentType}" can never be of type "${fragType}".`;
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
      var fragType = context.getType();
      var parentType = context.getParentType();
      if (fragType && parentType && !doTypesOverlap(fragType, parentType)) {
        context.reportError(new GraphQLError(
          typeIncompatibleAnonSpreadMessage(parentType, fragType),
          [ node ]
        ));
      }
    },
    FragmentSpread(node) {
      var fragName = node.name.value;
      var fragType = getFragmentType(context, fragName);
      var parentType = context.getParentType();
      if (fragType && parentType && !doTypesOverlap(fragType, parentType)) {
        context.reportError(new GraphQLError(
          typeIncompatibleSpreadMessage(fragName, parentType, fragType),
          [ node ]
        ));
      }
    }
  };
}

function getFragmentType(context, name) {
  var frag = context.getFragment(name);
  return frag && typeFromAST(context.getSchema(), frag.typeCondition);
}

function doTypesOverlap(t1, t2) {
  if (t1 === t2) {
    return true;
  }
  if (t1 instanceof GraphQLObjectType) {
    if (t2 instanceof GraphQLObjectType) {
      return false;
    }
    return t2.getPossibleTypes().indexOf(t1) !== -1;
  }
  if (t1 instanceof GraphQLInterfaceType || t1 instanceof GraphQLUnionType) {
    if (t2 instanceof GraphQLObjectType) {
      return t1.getPossibleTypes().indexOf(t2) !== -1;
    }
    var t1TypeNames = keyMap(t1.getPossibleTypes(), type => type.name);
    return t2.getPossibleTypes().some(type => t1TypeNames[type.name]);
  }
}
