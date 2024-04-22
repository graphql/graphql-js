import { GraphQLError } from '../../error/GraphQLError.js';

import type { ASTNode } from '../../language/ast.js';
import { Kind } from '../../language/kinds.js';
import type { ASTVisitor } from '../../language/visitor.js';

import type { ValidationContext } from '../ValidationContext.js';

const MAX_DEPTH = 3;

export function MaxIntrospectionDepthRule(
  context: ValidationContext,
): ASTVisitor {
  /**
   * Counts the depth of "__Type.fields" recursively and
   * returns `true` if the limit has been reached.
   */
  function checkDepth(node: ASTNode, depth: number = 0): boolean {
    if (node.kind === Kind.FRAGMENT_SPREAD) {
      const fragment = context.getFragment(node.name.value);
      if (!fragment) {
        throw new Error(`Fragment ${node.name.value} not found`);
      }
      return checkDepth(fragment, depth);
    }

    if (
      node.kind === Kind.FIELD &&
      // check all introspection lists
      (node.name.value === 'fields' ||
        node.name.value === 'interfaces' ||
        node.name.value === 'possibleTypes' ||
        node.name.value === 'inputFields') &&
      // eslint-disable-next-line no-param-reassign
      ++depth >= MAX_DEPTH
    ) {
      return true;
    }

    // handles fields and inline fragments
    if ('selectionSet' in node && node.selectionSet) {
      for (const child of node.selectionSet.selections) {
        if (checkDepth(child, depth)) {
          return true;
        }
      }
    }

    return false;
  }

  return {
    OperationDefinition(node) {
      for (const child of node.selectionSet.selections) {
        if (
          child.kind === Kind.FIELD &&
          (child.name.value === '__schema' || child.name.value === '__type')
        ) {
          if (checkDepth(node)) {
            context.reportError(
              new GraphQLError('Maximum introspection depth exceeded', {
                nodes: [node],
              }),
            );
            return;
          }
        }
      }
    },
  };
}
