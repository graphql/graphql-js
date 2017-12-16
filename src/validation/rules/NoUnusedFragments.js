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

export function unusedFragMessage(fragName: string): string {
  return `Fragment "${fragName}" is never used.`;
}

/**
 * No unused fragments
 *
 * A GraphQL document is only valid if all fragment definitions are spread
 * within operations, or spread within other fragments spread within operations.
 */
export function NoUnusedFragments(context: ValidationContext): ASTVisitor {
  const operationDefs = [];
  const fragmentDefs = [];

  return {
    OperationDefinition(node) {
      operationDefs.push(node);
      return false;
    },
    FragmentDefinition(node) {
      fragmentDefs.push(node);
      return false;
    },
    Document: {
      leave() {
        const fragmentNameUsed = Object.create(null);
        operationDefs.forEach(operation => {
          context
            .getRecursivelyReferencedFragments(operation)
            .forEach(fragment => {
              fragmentNameUsed[fragment.name.value] = true;
            });
        });

        fragmentDefs.forEach(fragmentDef => {
          const fragName = fragmentDef.name.value;
          if (fragmentNameUsed[fragName] !== true) {
            context.reportError(
              new GraphQLError(unusedFragMessage(fragName), [fragmentDef]),
            );
          }
        });
      },
    },
  };
}
