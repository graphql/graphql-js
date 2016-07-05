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
import suggestionList from '../../jsutils/suggestionList';
import quotedOrList from '../../jsutils/quotedOrList';
import {
  FIELD,
  DIRECTIVE
} from '../../language/kinds';
import type { GraphQLType } from '../../type/definition';


export function unknownArgMessage(
  argName: string,
  fieldName: string,
  type: GraphQLType,
  suggestedArgs: Array<string>
): string {
  let message = `Unknown argument "${argName}" on field "${fieldName}" of ` +
    `type "${String(type)}".`;
  if (suggestedArgs.length) {
    message += ` Did you mean ${quotedOrList(suggestedArgs)}?`;
  }
  return message;
}

export function unknownDirectiveArgMessage(
  argName: string,
  directiveName: string,
  suggestedArgs: Array<string>
): string {
  let message =
    `Unknown argument "${argName}" on directive "@${directiveName}".`;
  if (suggestedArgs.length) {
    message += ` Did you mean ${quotedOrList(suggestedArgs)}?`;
  }
  return message;
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
      const argumentOf = ancestors[ancestors.length - 1];
      if (argumentOf.kind === FIELD) {
        const fieldDef = context.getFieldDef();
        if (fieldDef) {
          const fieldArgDef = find(
            fieldDef.args,
            arg => arg.name === node.name.value
          );
          if (!fieldArgDef) {
            const parentType = context.getParentType();
            invariant(parentType);
            context.reportError(new GraphQLError(
              unknownArgMessage(
                node.name.value,
                fieldDef.name,
                parentType.name,
                suggestionList(
                  node.name.value,
                  fieldDef.args.map(arg => arg.name)
                )
              ),
              [ node ]
            ));
          }
        }
      } else if (argumentOf.kind === DIRECTIVE) {
        const directive = context.getDirective();
        if (directive) {
          const directiveArgDef = find(
            directive.args,
            arg => arg.name === node.name.value
          );
          if (!directiveArgDef) {
            context.reportError(new GraphQLError(
              unknownDirectiveArgMessage(
                node.name.value,
                directive.name,
                suggestionList(
                  node.name.value,
                  directive.args.map(arg => arg.name)
                )
              ),
              [ node ]
            ));
          }
        }
      }
    }
  };
}
