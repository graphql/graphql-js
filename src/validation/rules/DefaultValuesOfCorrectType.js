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
import { isValidLiteralValue } from '../../utilities/isValidLiteralValue';


export function defaultForNonNullArgMessage(
  varName: any,
  type: any,
  guessType: any
): string {
  return `Variable "$${varName}" of type "${type}" is required and will not ` +
    `use the default value. Perhaps you meant to use type "${guessType}".`;
}

export function badValueForDefaultArgMessage(
  varName: any,
  type: any,
  value: any,
  verboseErrors?: [any]
): string {
  var message = verboseErrors ? '\n' + verboseErrors.join('\n') : '';
  return `Variable "$${varName} has invalid default value ${value}.${message}`;
}

/**
 * Variable default values of correct type
 *
 * A GraphQL document is only valid if all variable default values are of the
 * type expected by their definition.
 */
export function DefaultValuesOfCorrectType(context: ValidationContext): any {
  return {
    VariableDefinition(varDefAST) {
      var name = varDefAST.variable.name.value;
      var defaultValue = varDefAST.defaultValue;
      var type = context.getInputType();
      if (type instanceof GraphQLNonNull && defaultValue) {
        context.reportError(new GraphQLError(
          defaultForNonNullArgMessage(name, type, type.ofType),
          [ defaultValue ]
        ));
      }
      if (type && defaultValue) {
        var errors = isValidLiteralValue(type, defaultValue);
        if (errors && errors.length > 0) {
          context.reportError(new GraphQLError(
            badValueForDefaultArgMessage(
              name,
              type,
              print(defaultValue),
              errors
            ),
            [ defaultValue ]
          ));
        }
      }
      return false;
    },
    SelectionSet: () => false,
    FragmentDefinition: () => false,
  };
}
