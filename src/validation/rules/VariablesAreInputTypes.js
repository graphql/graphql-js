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
import type { VariableDefinitionNode } from '../../language/ast';
import { print } from '../../language/printer';
import { isInputType } from '../../type/definition';
import { typeFromAST } from '../../utilities/typeFromAST';


export function nonInputTypeOnVarMessage(
  variableName: string,
  typeName: string
): string {
  return `Variable "$${variableName}" cannot be non-input type "${typeName}".`;
}

/**
 * Variables are input types
 *
 * A GraphQL operation is only valid if all the variables it defines are of
 * input types (scalar, enum, or input object).
 */
export function VariablesAreInputTypes(context: ValidationContext): any {
  return {
    VariableDefinition(node: VariableDefinitionNode): ?GraphQLError {
      const type = typeFromAST(context.getSchema(), node.type);

      // If the variable type is not an input type, return an error.
      if (type && !isInputType(type)) {
        const variableName = node.variable.name.value;
        context.reportError(new GraphQLError(
          nonInputTypeOnVarMessage(variableName, print(node.type)),
          [ node.type ]
        ));
      }
    }
  };
}
