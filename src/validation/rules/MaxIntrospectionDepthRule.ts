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
  const checkedFragments: { [key: string]: number | undefined } =
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
        const visitedFragments: { [key: string]: number } = Object.create(null);
        if (checkDepth(node, visitedFragments)) {
          context.reportError(
            new GraphQLError('Maximum introspection depth exceeded', {
              nodes: [node],
            }),
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
