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
import type { Name, VariableDefinition, Type } from '../../language/ast';
import invariant from '../../utils/invariant';
import { GraphQLError } from '../../error';
import { print } from '../../language/printer';
import { NAME } from '../../language/kinds';
import {
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInputObjectType
} from '../../type/definition';
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
      var typeName = getTypeASTName(node.type);
      var type = context.getSchema().getType(typeName);
      var isInputType =
        type instanceof GraphQLScalarType ||
        type instanceof GraphQLEnumType ||
        type instanceof GraphQLInputObjectType;
      if (!isInputType) {
        var variableName = node.variable.name.value;
        return new GraphQLError(
          nonInputTypeOnVarMessage(variableName, print(node.type)),
          [node.type]
        );
      }
    }
  };
}

function getTypeASTName(typeAST: Type): string {
  if (typeAST.kind === NAME) {
    return (typeAST: Name).value;
  }
  invariant(typeAST.type, 'Must be wrapping type');
  return getTypeASTName(typeAST.type);
}
