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
import find from '../../jsutils/find';
import invariant from '../../jsutils/invariant';
import {
  FIELD,
  DIRECTIVE
} from '../../language/kinds';


export function unknownArgMessage(
  argName: any,
  fieldName: any,
  type: any
): string {
  return `Unknown argument "${argName}" on field "${fieldName}" of ` +
    `type "${type}".`;
}

export function unknownDirectiveArgMessage(
  argName: any,
  directiveName: any
): string {
  return `Unknown argument "${argName}" on directive "@${directiveName}".`;
}

/**
 * Known argument names
 *
 * A GraphQL field is only valid if all supplied arguments are defined by
 * that field.
 */
export function KnownArgumentNames(context: ValidationContext): any {
  return {
    Argument(node, key, parent, path, ancestors) {
      var argumentOf = ancestors[ancestors.length - 1];
      if (argumentOf.kind === FIELD) {
        var fieldDef = context.getFieldDef();
        if (fieldDef) {
          var fieldArgDef = find(
            fieldDef.args,
            arg => arg.name === node.name.value
          );
          if (!fieldArgDef) {
            var parentType = context.getParentType();
            invariant(parentType);
            context.reportError(new GraphQLError(
              unknownArgMessage(
                node.name.value,
                fieldDef.name,
                parentType.name
              ),
              [ node ]
            ));
          }
        }
      } else if (argumentOf.kind === DIRECTIVE) {
        var directive = context.getDirective();
        if (directive) {
          var directiveArgDef = find(
            directive.args,
            arg => arg.name === node.name.value
          );
          if (!directiveArgDef) {
            context.reportError(new GraphQLError(
              unknownDirectiveArgMessage(node.name.value, directive.name),
              [ node ]
            ));
          }
        }
      }
    }
  };
}
