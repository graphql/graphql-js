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
import { unusedFragMessage } from '../errors';

/**
 * No unused fragments
 *
 * A GraphQL document is only valid if all fragment definitions are spread
 * within operations, or spread within other fragments spread within operations.
 */
export default function NoUnusedFragments(context: ValidationContext): any {
  var fragmentDefs = [];
  var spreadsWithinOperation = [];
  var fragAdjacencies = {};
  var spreadNames = {};

  return {
    OperationDefinition() {
      spreadNames = {};
      spreadsWithinOperation.push(spreadNames);
    },
    FragmentDefinition(def) {
      fragmentDefs.push(def);
      spreadNames = {};
      fragAdjacencies[def.name.value] = spreadNames;
    },
    FragmentSpread(spread) {
      spreadNames[spread.name.value] = true;
    },
    Document: {
      leave() {
        var fragmentNameUsed = {};
        var reduceSpreadFragments = function (spreads) {
          var keys = Object.keys(spreads);
          keys.forEach(fragName => {
            if (fragmentNameUsed[fragName] !== true) {
              fragmentNameUsed[fragName] = true;
              reduceSpreadFragments(fragAdjacencies[fragName]);
            }
          });
        };
        spreadsWithinOperation.forEach(reduceSpreadFragments);
        var errors = fragmentDefs
          .filter(def => fragmentNameUsed[def.name.value] !== true)
          .map(def => new GraphQLError(
            unusedFragMessage(def.name.value),
            [def]
          ));
        if (errors.length > 0) {
          return errors;
        }
      }
    }
  };
}
