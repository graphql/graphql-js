/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ASTValidationContext } from '../ValidationContext';
import type { VariableDefinitionNode } from '../../language/ast';
import { GraphQLError } from '../../error/GraphQLError';
import type { ASTVisitor } from '../../language/visitor';

export function duplicateVariableMessage(variableName: string): string {
  return `There can be only one variable named "${variableName}".`;
}

/**
 * Unique variable names
 *
 * A GraphQL operation is only valid if all its variables are uniquely named.
 */
export function UniqueVariableNames(context: ASTValidationContext): ASTVisitor {
  let knownVariableNames = Object.create(null);
  return {
    OperationDefinition() {
      knownVariableNames = Object.create(null);
    },
    VariableDefinition(node: VariableDefinitionNode) {
      const variableName = node.variable.name.value;
      if (knownVariableNames[variableName]) {
        context.reportError(
          new GraphQLError(duplicateVariableMessage(variableName), [
            knownVariableNames[variableName],
            node.variable.name,
          ]),
        );
      } else {
        knownVariableNames[variableName] = node.variable.name;
      }
    },
  };
}
