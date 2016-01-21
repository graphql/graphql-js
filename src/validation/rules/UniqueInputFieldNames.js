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


export function duplicateInputFieldMessage(fieldName: string): string {
  return `There can be only one input field named "${fieldName}".`;
}

/**
 * Unique input field names
 *
 * A GraphQL input object value is only valid if all supplied fields are
 * uniquely named.
 */
export function UniqueInputFieldNames(context: ValidationContext): any {
  const knownNameStack = [];
  let knownNames = Object.create(null);

  return {
    ObjectValue: {
      enter() {
        knownNameStack.push(knownNames);
        knownNames = Object.create(null);
      },
      leave() {
        knownNames = knownNameStack.pop();
      }
    },
    ObjectField(node) {
      const fieldName = node.name.value;
      if (knownNames[fieldName]) {
        context.reportError(new GraphQLError(
          duplicateInputFieldMessage(fieldName),
          [ knownNames[fieldName], node.name ]
        ));
      } else {
        knownNames[fieldName] = node.name;
      }
      return false;
    }
  };
}
