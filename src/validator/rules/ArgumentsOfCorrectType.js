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
import { missingArgMessage, badValueMessage } from '../errors';


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
    Field(fieldAST) {
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
            missingArgMessage(
              fieldAST.name.value,
              argDef.name,
              argDef.type
            ),
            [fieldAST]
          ));
        }
      });

      var argDefMap = keyMap(fieldDef.args, def => def.name);
      argASTs.forEach(argAST => {
        var argDef = argDefMap[argAST.name.value];
        if (argDef && !isValidLiteralValue(argAST.value, argDef.type)) {
          errors.push(new GraphQLError(
            badValueMessage(
              argAST.name.value,
              argDef.type,
              print(argAST.value)
            ),
            [argAST.value]
          ));
        }
      });

      if (errors.length > 0) {
        return errors;
      }
    }
  };
}
