/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ValidationContext } from '../index';
import { GraphQLError } from '../../error';
import type { FieldNode } from '../../language/ast';
import { getNamedType, isLeafType } from '../../type/definition';
import type { GraphQLType } from '../../type/definition';
import type { ASTVisitor } from '../../language/visitor';

export function noSubselectionAllowedMessage(
  fieldName: string,
  type: GraphQLType,
): string {
  return (
    `Field "${fieldName}" must not have a selection since ` +
    `type "${String(type)}" has no subfields.`
  );
}

export function requiredSubselectionMessage(
  fieldName: string,
  type: GraphQLType,
): string {
  return (
    `Field "${fieldName}" of type "${String(type)}" must have a ` +
    `selection of subfields. Did you mean "${fieldName} { ... }"?`
  );
}

/**
 * Scalar leafs
 *
 * A GraphQL document is valid only if all leaf fields (fields without
 * sub selections) are of scalar or enum types.
 */
export function ScalarLeafs(context: ValidationContext): ASTVisitor {
  return {
    Field(node: FieldNode) {
      const type = context.getType();
      const selectionSet = node.selectionSet;
      if (type) {
        if (isLeafType(getNamedType(type))) {
          if (selectionSet) {
            context.reportError(
              new GraphQLError(
                noSubselectionAllowedMessage(node.name.value, type),
                [selectionSet],
              ),
            );
          }
        } else if (!selectionSet) {
          context.reportError(
            new GraphQLError(
              requiredSubselectionMessage(node.name.value, type),
              [node],
            ),
          );
        }
      }
    },
  };
}
