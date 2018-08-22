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

export function unusedFragMessage(fragName: string): string {
  return `Fragment "${fragName}" is never used.`;
}

/**
 * No unused fragments
 *
 * A GraphQL document is only valid if all fragment definitions are spread
 * within operations, or spread within other fragments spread within operations.
 */
export function NoUnusedFragments(context: ASTValidationContext): ASTVisitor {
  const fragmentNameUsed = Object.create(null);
  const operationDefs = context.getDefinitionsMap().OperationDefinition || [];
  for (const operation of operationDefs) {
    for (const fragment of context.getRecursivelyReferencedFragments(
      operation,
    )) {
      fragmentNameUsed[fragment.name.value] = true;
    }
  }

  return {
    FragmentDefinition(node) {
      const fragName = node.name.value;
      if (fragmentNameUsed[fragName] !== true) {
        context.reportError(
          new GraphQLError(unusedFragMessage(fragName), [node]),
        );
      }
      return false;
    },
  };
}
