import { GraphQLError } from '../../error/GraphQLError.js';

import type { ASTNode } from '../../language/ast.js';
import { Kind } from '../../language/kinds.js';
import type { ASTVisitor } from '../../language/visitor.js';

import type { ASTValidationContext } from '../ValidationContext.js';

const MAX_INTROSPECTION_FIELDS_DEPTH = 3;

export function MaxIntrospectionDepthRule(
  context: ASTValidationContext,
): ASTVisitor {
  /**
   * Counts the "fields" recursively and returns `true` if the
   * limit has been reached; otherwise, returns the count.
   */
  function countDepth(node: ASTNode): number | true {
    let count = 0;

    if (node.kind === Kind.FRAGMENT_SPREAD) {
      const fragment = context.getFragment(node.name.value);
      if (!fragment) {
        throw new Error(`Fragment ${node.name.value} not found`);
      }
      return countDepth(fragment);
    }

    if ('selectionSet' in node && node.selectionSet) {
      for (const child of node.selectionSet.selections) {
        const countOrReached = countDepth(child);
        if (countOrReached === true) {
          return true;
        }
        count += countOrReached;
      }
    }

    if ('name' in node && node.name?.value === 'fields') {
      count++;
    }

    if (count >= MAX_INTROSPECTION_FIELDS_DEPTH) {
      return true;
    }

    return count;
  }

  return {
    Field(field) {
      if (field.name.value === '__schema' || field.name.value === '__type ') {
        const reached = countDepth(field);
        if (reached === true) {
          context.reportError(
            new GraphQLError('Maximum introspection depth exceeded'),
          );
        }
      }
    },
  };
}
