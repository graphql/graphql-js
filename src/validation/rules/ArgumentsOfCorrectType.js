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
import { badValueMessage } from '../errors';
import { print } from '../../language/printer';
import { isValidLiteralValue } from '../../utilities/isValidLiteralValue';


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
    Argument(argAST) {
      var argDef = context.getArgument();
      if (argDef && !isValidLiteralValue(argDef.type, argAST.value)) {
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
