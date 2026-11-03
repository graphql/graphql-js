import { GraphQLError } from '../../error/GraphQLError';

import type { ASTNode } from '../../language/ast';
import { Kind } from '../../language/kinds';
import type { ASTVisitor } from '../../language/visitor';

import type { ASTValidationContext } from '../ValidationContext';

const MAX_LISTS_DEPTH = 3;

export function MaxIntrospectionDepthRule(
  context: ASTValidationContext,
): ASTVisitor {
  const checkedFragments: {
    [key: string]: number | void,
    __proto__: null,
  } = Object.create(null);
  /**
   * Counts the depth of list fields in "__Type" recursively and
   * returns `true` if the limit has been reached.
   *
   * @internal
   */
  function checkDepth(
    node: ASTNode,
    visitedFragments: {
      [fragmentName: string]: number | void,
      __proto__: null,
    },
    initialDepth: number = 0,
  ): boolean {
    let depth = initialDepth;
    if (node.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = node.name.value;
      const visitedEntryDepth = visitedFragments[fragmentName];
      const checkedEntryDepth = checkedFragments[fragmentName];
      if (
        (visitedEntryDepth !== undefined && visitedEntryDepth >= depth) ||
        (checkedEntryDepth !== undefined && checkedEntryDepth >= depth)
      ) {
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
      depth++;
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
        const visitedFragments: {
          [key: string]: number | void,
          __proto__: null,
        } = Object.create(null);
        if (checkDepth(node, visitedFragments)) {
          context.reportError(
            new GraphQLError('Maximum introspection depth exceeded', [node]),
          );
          return false;
        }
        for (const name of Object.keys(visitedFragments)) {
          checkedFragments[name] = visitedFragments[name];
        }
      }
    },
  };
}
