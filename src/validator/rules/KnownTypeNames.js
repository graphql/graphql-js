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
import { unknownTypeMessage } from '../errors';


/**
 * Known type names
 *
 * A GraphQL document is only valid if referenced types (specifically
 * variable definitions and fragment conditions) are defined by the type schema.
 */
export default function KnownTypeNames(context: ValidationContext): any {
  return {
    Name(node, key) {
      if (key === 'type' || key === 'typeCondition') {
        var typeName = node.value;
        var type = context.getSchema().getType(typeName);
        if (!type) {
          return new GraphQLError(unknownTypeMessage(typeName), [node]);
        }
      }
    }
  };
}
