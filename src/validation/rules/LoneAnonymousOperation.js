/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ASTValidationContext } from '../ValidationContext';
import { GraphQLError } from '../../error/GraphQLError';
import type { ASTVisitor } from '../../language/visitor';

export function anonOperationNotAloneMessage(): string {
  return 'This anonymous operation must be the only defined operation.';
}

/**
 * Lone anonymous operation
 *
 * A GraphQL document is only valid if when it contains an anonymous operation
 * (the query short-hand) that it contains only that one operation definition.
 */
export function LoneAnonymousOperation(
  context: ASTValidationContext,
): ASTVisitor {
  const operationDefs = context.getDefinitionsMap().OperationDefinition;
  const operationCount = operationDefs ? operationDefs.length : 0;
  return {
    OperationDefinition(node) {
      if (!node.name && operationCount > 1) {
        context.reportError(
          new GraphQLError(anonOperationNotAloneMessage(), [node]),
        );
      }
    },
  };
}
