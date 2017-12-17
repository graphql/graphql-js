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
import { OPERATION_DEFINITION } from '../../language/kinds';
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
export function LoneAnonymousOperation(context: ValidationContext): ASTVisitor {
  let operationCount = 0;
  return {
    Document(node) {
      operationCount = node.definitions.filter(
        definition => definition.kind === OPERATION_DEFINITION,
      ).length;
    },
    OperationDefinition(node) {
      if (!node.name && operationCount > 1) {
        context.reportError(
          new GraphQLError(anonOperationNotAloneMessage(), [node]),
        );
      }
    },
  };
}
