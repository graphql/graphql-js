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
import { isValidLiteralValue } from '../../tools/isValidLiteralValue';
import {
  defaultForNonNullArgMessage,
  badValueForDefaultArgMessage,
} from '../errors';


/**
 * Variable default values of correct type
 *
 * A GraphQL document is only valid if all variable default values are of the
 * type expected by their definition.
 */
export default function DefaultValuesOfCorrectType(
  context: ValidationContext
): any {
  return {
    VariableDefinition(varDefAST) {
      var name = varDefAST.variable.name.value;
      var defaultValue = varDefAST.defaultValue;
      var type = context.getInputType();
      if (type instanceof GraphQLNonNull && defaultValue) {
        return new GraphQLError(
          defaultForNonNullArgMessage(name, type, type.ofType),
          [defaultValue]
        );
      }
      if (type && defaultValue && !isValidLiteralValue(type, defaultValue)) {
        return new GraphQLError(
          badValueForDefaultArgMessage(name, type, print(defaultValue)),
          [defaultValue]
        );
      }
    }
  };
}
