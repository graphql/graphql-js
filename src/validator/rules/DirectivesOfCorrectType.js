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
import isValidLiteralValue from '../../utils/isValidLiteralValue';
import find from '../../utils/find';
import {
  missingDirectiveValueMessage,
  noDirectiveValueMessage,
  badDirectiveValueMessage
} from '../errors';


/**
 * Directive values of correct type
 *
 * A GraphQL document is only valid if all literal directive values are of the
 * correct expected type.
 */
export default function DirectivesOfCorrectType(
  context: ValidationContext
): any {
  return {
    Directive(node) {
      var directiveName = node.name.value;
      var valueAST = node.value;

      var directiveDef = find(
        context.getSchema().getDirectives(),
        def => def.name === directiveName
      );
      if (!directiveDef) {
        return false;
      }
      var typeDef = directiveDef.type;

      if (!valueAST && typeDef instanceof GraphQLNonNull) {
        return new GraphQLError(
          missingDirectiveValueMessage(
            directiveName,
            typeDef
          ),
          [node]
        );
      }

      if (!typeDef && valueAST) {
        return new GraphQLError(
          noDirectiveValueMessage(directiveName),
          [valueAST]
        );
      }

      if (typeDef && valueAST && !isValidLiteralValue(valueAST, typeDef)) {
        return new GraphQLError(
          badDirectiveValueMessage(
            directiveName,
            typeDef,
            print(valueAST)
          ),
          [valueAST]
        );
      }
    }
  };
}
