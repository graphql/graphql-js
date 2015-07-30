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
import { unknownArgMessage } from '../errors';
import invariant from '../../jsutils/invariant';
import find from '../../jsutils/find';


/**
 * Known argument names
 *
 * A GraphQL field is only valid if all supplied arguments are defined by
 * that field.
 */
export default function KnownArgumentNames(context: ValidationContext): any {
  return {
    Argument(node) {
      var fieldDef = context.getFieldDef();
      if (fieldDef) {
        var argDef = find(fieldDef.args, arg => arg.name === node.name.value);
        if (!argDef) {
          var parentType = context.getParentType();
          invariant(parentType);
          return new GraphQLError(
            unknownArgMessage(node.name.value, fieldDef.name, parentType.name),
            [node]
          );
        }
      }
    }
  };
}
