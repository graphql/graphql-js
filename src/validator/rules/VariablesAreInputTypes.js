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
import type { VariableDefinition } from '../../language/ast';
import { GraphQLError } from '../../error';
import { print } from '../../language/printer';
import { isInputType } from '../../type/definition';
import { typeFromAST } from '../../tools/typeFromAST';
import { nonInputTypeOnVarMessage } from '../errors';


/**
 * Variables are input types
 *
 * A GraphQL operation is only valid if all the variables it defines are of
 * input types (scalar, enum, or input object).
 */
export default function VariablesAreInputTypes(
  context: ValidationContext
): any {
  return {
    VariableDefinition(node: VariableDefinition): ?GraphQLError {
      var type = typeFromAST(context.getSchema(), node.type);

      // If the variable type is not an input type, return an error.
      if (type && !isInputType(type)) {
        var variableName = node.variable.name.value;
        return new GraphQLError(
          nonInputTypeOnVarMessage(variableName, print(node.type)),
          [node.type]
        );
      }
    }
  };
}
