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


export function duplicateArgMessage(argName: string): string {
  return `There can be only one argument named "${argName}".`;
}

/**
 * Unique argument names
 *
 * A GraphQL field or directive is only valid if all supplied arguments are
 * uniquely named.
 */
export function UniqueArgumentNames(context: ValidationContext): any {
  let knownArgNames = Object.create(null);
  return {
    Field() {
      knownArgNames = Object.create(null);
    },
    Directive() {
      knownArgNames = Object.create(null);
    },
    Argument(node) {
      const argName = node.name.value;
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
