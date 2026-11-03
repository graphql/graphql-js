/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ASTNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import type { ASTValidationContext } from '../ValidationContext.ts';

const MAX_LISTS_DEPTH = 3;

/**
 * Implements the max introspection depth validation rule.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { MaxIntrospectionDepthRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { __schema { types { fields { type { fields { type { fields { name } } } } } } } }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   MaxIntrospectionDepthRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { __schema { queryType { name } } }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   MaxIntrospectionDepthRule,
 * ]); // => []
 * ```
 */
export function MaxIntrospectionDepthRule(
  context: ASTValidationContext,
): ASTVisitor {
  // For each fragment, the greatest entry depth at which its check completed
  // without reaching the limit. Shared across root checks.
  // Entry depth is the list depth before entering the fragment.
  const checkedFragments: { [key: string]: number | undefined } =
    Object.create(null);

  // For each fragment, the smallest entry depth at which its check reached
  // the limit. Shared across root checks.
  const exceededFragments: { [key: string]: number | undefined } =
    Object.create(null);

  /**
   * Counts the depth of list fields in "__Type" recursively and
   * returns `true` if the limit has been reached.
   *
   * @internal
   */
  function checkDepth(
    node: ASTNode,
    visitedFragments: {
      [fragmentName: string]: number | undefined;
    },
    depth: number = 0,
  ): boolean {
    if (node.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = node.name.value;
      const exceededEntryDepth = exceededFragments[fragmentName];
      // A check that reached the limit will also do so when repeated at an
      // equal or greater entry depth.
      if (exceededEntryDepth !== undefined && exceededEntryDepth <= depth) {
        return true;
      }
      const visitedEntryDepth = visitedFragments[fragmentName];
      const checkedEntryDepth = checkedFragments[fragmentName];
      // At equal or shallower entry depths, skip revisits to break cycles
      // or reuse a completed successful check.
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
      if (checkDepth(fragment, visitedFragments, depth)) {
        exceededFragments[fragmentName] = depth;
        return true;
      }
      checkedFragments[fragmentName] = depth;
      return false;
    }

    if (
      node.kind === Kind.FIELD &&
      // check all introspection lists
      (node.name.value === 'fields' ||
        node.name.value === 'interfaces' ||
        node.name.value === 'possibleTypes' ||
        node.name.value === 'inputFields')
    ) {
      // eslint-disable-next-line no-param-reassign
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
        // For each fragment, the greatest entry depth at which it was visited
        // during this root check, including visits still in progress.
        const visitedFragments: { [key: string]: number } = Object.create(null);
        if (checkDepth(node, visitedFragments)) {
          context.reportError(
            new GraphQLError('Maximum introspection depth exceeded', {
              nodes: [node],
            }),
          );
          return false;
        }
      }
    },
  };
}
