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


export function unusedFragMessage(fragName: any): string {
  return `Fragment "${fragName}" is never used.`;
}

/**
 * No unused fragments
 *
 * A GraphQL document is only valid if all fragment definitions are spread
 * within operations, or spread within other fragments spread within operations.
 */
export function NoUnusedFragments(context: ValidationContext): any {
  var spreadsWithinOperation = [];
  var fragmentDefs = [];

  return {
    OperationDefinition(node) {
      spreadsWithinOperation.push(context.getFragmentSpreads(node));
      return false;
    },
    FragmentDefinition(def) {
      fragmentDefs.push(def);
      return false;
    },
    Document: {
      leave() {
        var fragmentNameUsed = {};
        var reduceSpreadFragments = function (spreads) {
          spreads.forEach(spread => {
            const fragName = spread.name.value;
            if (fragmentNameUsed[fragName] !== true) {
              fragmentNameUsed[fragName] = true;
              const fragment = context.getFragment(fragName);
              if (fragment) {
                reduceSpreadFragments(context.getFragmentSpreads(fragment));
              }
            }
          });
        };
        spreadsWithinOperation.forEach(reduceSpreadFragments);
        var errors = fragmentDefs
          .filter(def => fragmentNameUsed[def.name.value] !== true)
          .map(def => new GraphQLError(
            unusedFragMessage(def.name.value),
            [ def ]
          ));
        if (errors.length > 0) {
          return errors;
        }
      }
    }
  };
}
