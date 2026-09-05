/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import { print } from '../../language/printer.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Fragment type conditions must name composite types.
 *
 * See https://spec.graphql.org/draft/#sec-Fragments-On-Composite-Types
 * @category Validation Rules
 
 * @internal
 */
export const FragmentsOnCompositeTypesASTVisitor: ASTVisitorFn = (context) => {
  const { index } = context;

  return {
    InlineFragment(node) {
      const typeCondition = node.typeCondition;
      if (typeCondition == null) {
        return;
      }

      const type = index.getTypeReference(typeCondition);
      if (type != null && !index.isCompositeType(type)) {
        const typeStr = print(typeCondition);
        context.reportError(
          new GraphQLError(
            `Fragment cannot condition on non composite type "${typeStr}".`,
            { nodes: typeCondition },
          ),
        );
      }
    },
    FragmentDefinition(node) {
      const type = index.getTypeReference(node.typeCondition);
      if (type != null && !index.isCompositeType(type)) {
        const typeStr = print(node.typeCondition);
        context.reportError(
          new GraphQLError(
            `Fragment "${node.name.value}" cannot condition on non composite type "${typeStr}".`,
            { nodes: node.typeCondition },
          ),
        );
      }
    },
  };
};
