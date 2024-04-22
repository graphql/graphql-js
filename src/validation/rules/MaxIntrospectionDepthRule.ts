import { GraphQLError } from '../../error/GraphQLError.js';

import type { ASTNode } from '../../language/ast.js';
import { Kind } from '../../language/kinds.js';
import type { ASTVisitor } from '../../language/visitor.js';
import { BREAK } from '../../language/visitor.js';

import type { ValidationContext } from '../ValidationContext.js';

const MAX_FIELDS_DEPTH = 3;

export function MaxIntrospectionDepthRule(
  context: ValidationContext,
): ASTVisitor {
  /**
   * Counts the depth of "__Type.fields" recursively and
   * returns `true` if the limit has been reached.
   */
  function checkFieldsDepth(node: ASTNode, depth: number = 0): boolean {
    if (node.kind === Kind.FRAGMENT_SPREAD) {
      const fragment = context.getFragment(node.name.value);
      if (!fragment) {
        throw new Error(`Fragment ${node.name.value} not found`);
      }
      return checkFieldsDepth(fragment, depth);
    }

    if (
      'name' in node &&
      node.name?.value === 'fields' &&
      // eslint-disable-next-line no-param-reassign
      ++depth >= MAX_FIELDS_DEPTH
    ) {
      return true;
    }

    // handles inline fragments as well
    if ('selectionSet' in node && node.selectionSet) {
      for (const child of node.selectionSet.selections) {
        if (checkFieldsDepth(child, depth)) {
          return true;
        }
      }
    }

    return false;
  }

  return {
    Field(field) {
      if (field.name.value === '__schema' || field.name.value === '__type') {
        if (checkFieldsDepth(field)) {
          context.reportError(
            new GraphQLError('Maximum introspection depth exceeded'),
          );
          return BREAK;
        }
      }
    },
  };
}
