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
import { print } from '../../language/printer';
import { GraphQLNonNull } from '../../type/definition';
import keyMap from '../../utils/keyMap';
import isValidLiteralValue from '../../utils/isValidLiteralValue';
import {
  missingFieldArgMessage,
  missingDirectiveArgMessage,
  badValueMessage
} from '../errors';


/**
 * Argument values of correct type
 *
 * A GraphQL document is only valid if all field argument literal values are
 * of the type expected by their position.
 */
export default function ArgumentsOfCorrectType(
  context: ValidationContext
): any {
  return {
    Field: {
      // Validate on leave to allow for deeper errors to also appear
      leave(fieldAST) {
        var fieldDef = context.getFieldDef();
        if (!fieldDef) {
          return false;
        }
        var errors = [];
        var argASTs = fieldAST.arguments || [];

        var argASTMap = keyMap(argASTs, arg => arg.name.value);
        fieldDef.args.forEach(argDef => {
          var argAST = argASTMap[argDef.name];
          if (!argAST && argDef.type instanceof GraphQLNonNull) {
            errors.push(new GraphQLError(
              missingFieldArgMessage(
                fieldAST.name.value,
                argDef.name,
                argDef.type
              ),
              [fieldAST]
            ));
          }
        });

        if (errors.length > 0) {
          return errors;
        }
      }
    },

    Directive: {
      // Validate on leave to allow for deeper errors to also appear
      leave(directiveAST) {
        var directiveDef = context.getDirective();
        if (!directiveDef) {
          return false;
        }
        var errors = [];
        var argASTs = directiveAST.arguments || [];

        var argASTMap = keyMap(argASTs, arg => arg.name.value);
        directiveDef.args.forEach(argDef => {
          var argAST = argASTMap[argDef.name];
          if (!argAST && argDef.type instanceof GraphQLNonNull) {
            errors.push(new GraphQLError(
              missingDirectiveArgMessage(
                directiveAST.name.value,
                argDef.name,
                argDef.type
              ),
              [directiveAST]
            ));
          }
        });

        if (errors.length > 0) {
          return errors;
        }
      }
    },

    Argument(argAST) {
      var argDef = context.getArgument();
      if (argDef && !isValidLiteralValue(argAST.value, argDef.type)) {
        return new GraphQLError(
          badValueMessage(
            argAST.name.value,
            argDef.type,
            print(argAST.value)
          ),
          [argAST.value]
        );
      }
    }

  };
}
