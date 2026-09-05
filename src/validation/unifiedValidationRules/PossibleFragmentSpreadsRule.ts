/** @category Validation Rules */

import type { Maybe } from '../../jsutils/Maybe.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { CompositeTypeReference } from '../TypeSystemValidationIndex.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Fragment spreads must be possible for their parent type.
 *
 * See https://spec.graphql.org/draft/#sec-Fragment-spread-is-possible
 * @category Validation Rules
 
 * @internal
 */
export const PossibleFragmentSpreadsASTVisitor: ASTVisitorFn = (context) => {
  const { index, indexCursor } = context;

  return {
    InlineFragment(node) {
      const fragType = indexCursor.getCurrentType();
      const parentType = indexCursor.getCurrentParentType();
      if (
        fragType != null &&
        parentType != null &&
        index.isCompositeType(fragType) &&
        !index.doTypesOverlap(fragType, parentType)
      ) {
        const parentTypeStr = index.typeToString(parentType);
        const fragTypeStr = index.typeToString(fragType);
        context.reportError(
          new GraphQLError(
            `Fragment cannot be spread here as objects of type "${parentTypeStr}" can never be of type "${fragTypeStr}".`,
            { nodes: node },
          ),
        );
      }
    },
    FragmentSpread(node) {
      const fragName = node.name.value;
      const fragType = getFragmentType(fragName);
      const parentType = indexCursor.getCurrentParentType();
      if (
        fragType != null &&
        parentType != null &&
        !index.doTypesOverlap(fragType, parentType)
      ) {
        const parentTypeStr = index.typeToString(parentType);
        const fragTypeStr = index.typeToString(fragType);
        context.reportError(
          new GraphQLError(
            `Fragment "${fragName}" cannot be spread here as objects of type "${parentTypeStr}" can never be of type "${fragTypeStr}".`,
            { nodes: node },
          ),
        );
      }
    },
  };

  function getFragmentType(name: string): Maybe<CompositeTypeReference> {
    const fragment = context.getFragment(name);
    if (fragment == null) {
      return;
    }

    const type = index.getOutputTypeReference(fragment.typeCondition);
    if (type != null && index.isCompositeType(type)) {
      return type;
    }
  }
};
