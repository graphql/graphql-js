/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { ValidationContext } from '../index';
import { GraphQLError } from '../../error';
import { print } from '../../language/printer';
import { isValidLiteralValue } from '../../utilities/isValidLiteralValue';
import type { GraphQLType } from '../../type/definition';


export function badValueMessage(
  argName: string,
  type: GraphQLType,
  value: string,
  verboseErrors?: string[]
): string {
  const message = verboseErrors ? '\n' + verboseErrors.join('\n') : '';
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
    Argument(node) {
      const argDef = context.getArgument();
      if (argDef) {
        const errors = isValidLiteralValue(argDef.type, node.value);
        if (errors && errors.length > 0) {
          context.reportError(new GraphQLError(
            badValueMessage(
              node.name.value,
              argDef.type,
              print(node.value),
              errors
            ),
            [ node.value ]
          ));
        }
      }
      return false;
    }
  };
}
