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
import { isValidLiteralValue } from '../../utilities/isValidLiteralValue';


export function badValueMessage(
  argName: any,
  type: any,
  value: any,
  verboseErrors?: [any]
): string {
  var message = verboseErrors ? '\n' + verboseErrors.join('\n') : '';
  return (
    `Argument "${argName}" has invalid value ${value}.${message}`
  );
}

/**
 * Argument values of correct type
 *
 * A GraphQL document is only valid if all field argument literal values are
 * of the type expected by their position.
 */
export function ArgumentsOfCorrectType(context: ValidationContext): any {
  return {
    Argument(argAST) {
      var argDef = context.getArgument();
      if (argDef) {
        var errors = isValidLiteralValue(argDef.type, argAST.value);
        if (errors && errors.length > 0) {
          context.reportError(new GraphQLError(
            badValueMessage(
              argAST.name.value,
              argDef.type,
              print(argAST.value),
              errors
            ),
            [ argAST.value ]
          ));
        }
      }
      return false;
    }
  };
}
