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
import type { Field } from '../../language/ast';


export function undefinedFieldMessage(fieldName: any, type: any): string {
  return `Cannot query field "${fieldName}" on "${type}".`;
}

/**
 * Fields on correct type
 *
 * A GraphQL document is only valid if all fields selected are defined by the
 * parent type, or are an allowed meta field such as __typenamme
 */
export function FieldsOnCorrectType(context: ValidationContext): any {
  return {
    Field(node: Field) {
      var type = context.getParentType();
      if (type) {
        var fieldDef = context.getFieldDef();
        if (!fieldDef) {
          context.reportError(new GraphQLError(
            undefinedFieldMessage(node.name.value, type.name),
            [ node ]
          ));
        }
      }
    }
  };
}
