import { GraphQLError } from '../../error/GraphQLError.js';

import type { ASTNode } from '../../language/ast.js';
import { Kind } from '../../language/kinds.js';
import type { ASTVisitor } from '../../language/visitor.js';

import type { ASTValidationContext } from '../ValidationContext.js';

const MAX_INTROSPECTION_FIELDS_DEPTH = 3;

export function MaxIntrospectionDepthRule(
  context: ASTValidationContext,
): ASTVisitor {
  function countDepth(node: ASTNode, count = 0) {
    if (node.kind === Kind.FRAGMENT_SPREAD) {
      const fragment = context.getFragment(node.name.value);
      if (!fragment) {
        throw new Error(`Fragment ${node.name.value} not found`);
      }
      return countDepth(fragment, count);
    }

    if ('selectionSet' in node && node.selectionSet) {
      for (const child of node.selectionSet.selections) {
        count = countDepth(child, count);
      }
    }

    if ('name' in node && node.name?.value === 'fields') {
      count++;
    }

    if (count >= MAX_INTROSPECTION_FIELDS_DEPTH) {
      throw new GraphQLError('Maximum introspection depth exceeded');
    }

    return count;
  }

  return {
    Field(field) {
      if (field.name.value === '__schema' || field.name.value === '__type ') {
        try {
          countDepth(field);
        } catch (err) {
          if (err instanceof GraphQLError) {
            context.reportError(err);
          } else {
            throw err;
          }
        }
      }
    },
  };
}
