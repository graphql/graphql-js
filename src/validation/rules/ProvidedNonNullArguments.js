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
import keyMap from '../../jsutils/keyMap';
import { GraphQLNonNull } from '../../type/definition';


export function missingFieldArgMessage(
  fieldName: any,
  argName: any,
  type: any
): string {
  return `Field "${fieldName}" argument "${argName}" of type "${type}" ` +
    `is required but not provided.`;
}

export function missingDirectiveArgMessage(
  directiveName: any,
  argName: any,
  type: any
): string {
  return `Directive "@${directiveName}" argument "${argName}" of type ` +
    `"${type}" is required but not provided.`;
}

/**
 * Provided required arguments
 *
 * A field or directive is only valid if all required (non-null) field arguments
 * have been provided.
 */
export function ProvidedNonNullArguments(context: ValidationContext): any {
  return {
    Field: {
      // Validate on leave to allow for deeper errors to appear first.
      leave(fieldAST) {
        var fieldDef = context.getFieldDef();
        if (!fieldDef) {
          return false;
        }
        var argASTs = fieldAST.arguments || [];

        var argASTMap = keyMap(argASTs, arg => arg.name.value);
        fieldDef.args.forEach(argDef => {
          var argAST = argASTMap[argDef.name];
          if (!argAST && argDef.type instanceof GraphQLNonNull) {
            context.reportError(new GraphQLError(
              missingFieldArgMessage(
                fieldAST.name.value,
                argDef.name,
                argDef.type
              ),
              [ fieldAST ]
            ));
          }
        });
      }
    },

    Directive: {
      // Validate on leave to allow for deeper errors to appear first.
      leave(directiveAST) {
        var directiveDef = context.getDirective();
        if (!directiveDef) {
          return false;
        }
        var argASTs = directiveAST.arguments || [];

        var argASTMap = keyMap(argASTs, arg => arg.name.value);
        directiveDef.args.forEach(argDef => {
          var argAST = argASTMap[argDef.name];
          if (!argAST && argDef.type instanceof GraphQLNonNull) {
            context.reportError(new GraphQLError(
              missingDirectiveArgMessage(
                directiveAST.name.value,
                argDef.name,
                argDef.type
              ),
              [ directiveAST ]
            ));
          }
        });
      }
    }
  };
}
