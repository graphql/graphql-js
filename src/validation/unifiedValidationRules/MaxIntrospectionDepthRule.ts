/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ASTNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

const MAX_LISTS_DEPTH = 3;

/** Introspection list nesting must not exceed the configured maximum.
 * @internal
 */
export const MaxIntrospectionDepthASTVisitor: ASTVisitorFn = (context) => {
  function checkDepth(
    node: ASTNode,
    visitedFragments: {
      [fragmentName: string]: true | undefined;
    } = Object.create(null),
    depth: number = 0,
  ): boolean {
    if (node.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = node.name.value;
      if (visitedFragments[fragmentName] === true) {
        return false;
      }
      const fragment = context.getFragment(fragmentName);
      if (fragment == null) {
        return false;
      }

      try {
        visitedFragments[fragmentName] = true;
        return checkDepth(fragment, visitedFragments, depth);
      } finally {
        visitedFragments[fragmentName] = undefined;
      }
    }

    if (
      node.kind === Kind.FIELD &&
      (node.name.value === 'fields' ||
        node.name.value === 'interfaces' ||
        node.name.value === 'possibleTypes' ||
        node.name.value === 'inputFields')
    ) {
      // eslint-disable-next-line no-param-reassign
      ++depth;
      if (depth >= MAX_LISTS_DEPTH) {
        return true;
      }
    }

    if ('selectionSet' in node && node.selectionSet != null) {
      for (const child of node.selectionSet.selections) {
        if (checkDepth(child, visitedFragments, depth)) {
          return true;
        }
      }
    }

    return false;
  }

  return {
    Field(node) {
      if (
        (node.name.value === '__schema' || node.name.value === '__type') &&
        checkDepth(node)
      ) {
        context.reportError(
          new GraphQLError('Maximum introspection depth exceeded', {
            nodes: [node],
          }),
        );
        return false;
      }
    },
  };
};
