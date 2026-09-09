/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Leaf fields must not have selection sets, and composite fields must have them.
 *
 * See https://spec.graphql.org/draft/#sec-Leaf-Field-Selections
 * @category Validation Rules
 
 * @internal
 */
export const ScalarLeafsASTVisitor: ASTVisitorFn = (context) => {
  const { index, indexCursor } = context;

  return {
    Field(node) {
      const type = indexCursor.getCurrentType();
      if (type == null) {
        return;
      }

      const fieldName = node.name.value;
      const selectionSet = node.selectionSet;
      if (index.isLeafType(type)) {
        if (selectionSet != null) {
          const typeStr = index.typeToString(type);
          context.reportError(
            new GraphQLError(
              `Field "${fieldName}" must not have a selection since type "${typeStr}" has no subfields.`,
              { nodes: selectionSet },
            ),
          );
        }
      } else if (selectionSet == null) {
        const typeStr = index.typeToString(type);
        context.reportError(
          new GraphQLError(
            `Field "${fieldName}" of type "${typeStr}" must have a selection of subfields. Did you mean "${fieldName} { ... }"?`,
            { nodes: node },
          ),
        );
      } else if (selectionSet.selections.length === 0) {
        const typeStr = index.typeToString(type);
        context.reportError(
          new GraphQLError(
            `Field "${fieldName}" of type "${typeStr}" must have at least one field selected.`,
            { nodes: node },
          ),
        );
      }
    },
  };
};
