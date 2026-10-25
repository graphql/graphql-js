import { GraphQLError } from '../../error/GraphQLError';

import type { ASTNode } from '../../language/ast';
import { Kind } from '../../language/kinds';
import type { ASTVisitor } from '../../language/visitor';

import type { ASTValidationContext } from '../ValidationContext';

const MAX_LISTS_DEPTH = 3;

export function MaxIntrospectionDepthRule(
  context: ASTValidationContext,
): ASTVisitor {
  /**
   * Counts the depth of list fields in "__Type" recursively and
   * returns `true` if the limit has been reached.
   */
  function checkDepth(
    node: ASTNode,
    visitedFragments: {
      [fragmentName: string]: number | null,
      __proto__: null,
    } = Object.create(null),
    depth: number = 0,
  ): boolean {
    if (node.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = node.name.value;
      const visitedDepth = visitedFragments[fragmentName];
      if (visitedDepth != null && visitedDepth >= depth) {
        return false;
      }
      const fragment = context.getFragment(fragmentName);
      if (!fragment) {
        // Missing fragments checks are handled by `KnownFragmentNamesRule`.
        return false;
      }

      visitedFragments[fragmentName] = depth;
      return checkDepth(fragment, visitedFragments, depth);
    }

    if (
      node.kind === Kind.FIELD &&
      // check all introspection lists
      (node.name.value === 'fields' ||
        node.name.value === 'interfaces' ||
        node.name.value === 'possibleTypes' ||
        node.name.value === 'inputFields')
    ) {
      // $FlowFixMe[reassign-const] why are argument parameters treated as const in flow?
      depth++; // eslint-disable-line no-param-reassign
      if (depth >= MAX_LISTS_DEPTH) {
        return true;
      }
    }

    // handles fields and inline fragments
    if ('selectionSet' in node && node.selectionSet) {
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
      if (node.name.value === '__schema' || node.name.value === '__type') {
        if (checkDepth(node)) {
          context.reportError(
            new GraphQLError('Maximum introspection depth exceeded', [node]),
          );
          return false;
        }
      }
    },
  };
}
