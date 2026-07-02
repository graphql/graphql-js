/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Fragment spreads must refer to fragments defined in the same document.
 *
 * See https://spec.graphql.org/draft/#sec-Fragment-spread-target-defined
 * @category Validation Rules
 
 * @internal
 */
export const KnownFragmentNamesASTVisitor: ASTVisitorFn = (context) => ({
  FragmentSpread(node) {
    const fragmentName = node.name.value;
    if (context.getFragment(fragmentName) == null) {
      context.reportError(
        new GraphQLError(`Unknown fragment "${fragmentName}".`, {
          nodes: node.name,
        }),
      );
    }
  },
});
