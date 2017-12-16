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
import type { ASTVisitor } from '../../language/visitor';
import { isNonNullType } from '../../type/definition';
import type { GraphQLType } from '../../type/definition';

export function defaultForRequiredVarMessage(
  varName: string,
  type: GraphQLType,
  guessType: GraphQLType,
): string {
  return (
    `Variable "$${varName}" of type "${String(type)}" is required and ` +
    'will not use the default value. ' +
    `Perhaps you meant to use type "${String(guessType)}".`
  );
}

/**
 * Variable's default value is allowed
 *
 * A GraphQL document is only valid if all variable default values are allowed
 * due to a variable not being required.
 */
export function VariablesDefaultValueAllowed(
  context: ValidationContext,
): ASTVisitor {
  return {
    VariableDefinition(node) {
      const name = node.variable.name.value;
      const defaultValue = node.defaultValue;
      const type = context.getInputType();
      if (isNonNullType(type) && defaultValue) {
        context.reportError(
          new GraphQLError(
            defaultForRequiredVarMessage(name, type, type.ofType),
            [defaultValue],
          ),
        );
      }
      return false; // Do not traverse further.
    },
    SelectionSet: () => false,
    FragmentDefinition: () => false,
  };
}
