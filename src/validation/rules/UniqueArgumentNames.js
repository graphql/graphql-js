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


export function duplicateArgMessage(argName: any): string {
  return `There can be only one argument named "${argName}".`;
}

/**
 * Unique argument names
 *
 * A GraphQL field or directive is only valid if all supplied arguments are
 * uniquely named.
 */
export function UniqueArgumentNames(context: ValidationContext): any {
  var knownArgNames = Object.create(null);
  return {
    Field() {
      knownArgNames = Object.create(null);
    },
    Directive() {
      knownArgNames = Object.create(null);
    },
    Argument(node) {
      var argName = node.name.value;
      if (knownArgNames[argName]) {
        context.reportError(new GraphQLError(
          duplicateArgMessage(argName),
          [ knownArgNames[argName], node.name ]
        ));
      } else {
        knownArgNames[argName] = node.name;
      }
      return false;
    }
  };
}
