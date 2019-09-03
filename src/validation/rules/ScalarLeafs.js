// @flow strict

import inspect from '../../jsutils/inspect';

import { GraphQLError } from '../../error/GraphQLError';

import { type FieldNode } from '../../language/ast';
import { type ASTVisitor } from '../../language/visitor';

import { getNamedType, isLeafType } from '../../type/definition';

import { type ValidationContext } from '../ValidationContext';

export function noSubselectionAllowedMessage(
  fieldName: string,
  type: string,
): string {
  return `Field "${fieldName}" must not have a selection since type "${type}" has no subfields.`;
}

export function requiredSubselectionMessage(
  fieldName: string,
  type: string,
): string {
  return `Field "${fieldName}" of type "${type}" must have a selection of subfields. Did you mean "${fieldName} { ... }"?`;
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
            const fieldName = node.name.value;
            const typeStr = inspect(type);
            context.reportError(
              new GraphQLError(
                `Field "${fieldName}" must not have a selection since type "${typeStr}" has no subfields.`,
                selectionSet,
              ),
            );
          }
        } else if (!selectionSet) {
          const fieldName = node.name.value;
          const typeStr = inspect(type);
          context.reportError(
            new GraphQLError(
              `Field "${fieldName}" of type "${typeStr}" must have a selection of subfields. Did you mean "${fieldName} { ... }"?`,
              node,
            ),
          );
        }
      }
    },
  };
}
