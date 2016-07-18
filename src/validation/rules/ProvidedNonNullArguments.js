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
import type { GraphQLType } from '../../type/definition';


export function missingFieldArgMessage(
  fieldName: string,
  argName: string,
  type: GraphQLType
): string {
  return `Field "${fieldName}" argument "${argName}" of type ` +
    `"${String(type)}" is required but not provided.`;
}

export function missingDirectiveArgMessage(
  directiveName: string,
  argName: string,
  type: GraphQLType
): string {
  return `Directive "@${directiveName}" argument "${argName}" of type ` +
    `"${String(type)}" is required but not provided.`;
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
        const fieldDef = context.getFieldDef();
        if (!fieldDef) {
          return false;
        }
        const argASTs = fieldAST.arguments || [];

        const argASTMap = keyMap(argASTs, arg => arg.name.value);
        fieldDef.args.forEach(argDef => {
          const argAST = argASTMap[argDef.name];
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
        const directiveDef = context.getDirective();
        if (!directiveDef) {
          return false;
        }
        const argASTs = directiveAST.arguments || [];

        const argASTMap = keyMap(argASTs, arg => arg.name.value);
        directiveDef.args.forEach(argDef => {
          const argAST = argASTMap[argDef.name];
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
