import { GraphQLError } from '../../../error/GraphQLError';

import type { ASTVisitor } from '../../../language/visitor';

import type { ASTValidationContext } from '../../ValidationContext';

/**
 * Fragment arguments are, by default, not allowed to be used.
 */
export function NoFragmentArgumentUsageRule(
  context: ASTValidationContext,
): ASTVisitor {
  return {
    FragmentDefinition(node) {
      if (node.variableDefinitions && node.variableDefinitions.length > 0) {
        context.reportError(
          new GraphQLError(
            'Fragment argument definitions are not enabled.',
            node.variableDefinitions[0],
          ),
        );
      }
    },
    FragmentSpread(node) {
      if (node.arguments && node.arguments.length > 0) {
        context.reportError(
          new GraphQLError(
            'Fragment arguments are not enabled.',
            node.arguments[0],
          ),
        );
      }
    },
  };
}
