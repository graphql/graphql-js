import { groupBy } from '../../jsutils/groupBy';

import { GraphQLError } from '../../error/GraphQLError';

import type { ArgumentNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import type { ASTValidationContext } from '../ValidationContext';

/**
 * Unique argument names
 *
 * A GraphQL field or directive is only valid if all supplied arguments are
 * uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Argument-Names
 */
export function UniqueArgumentNamesRule(
  context: ASTValidationContext,
): ASTVisitor {
  return {
    Field: checkArgUniqueness,
    Directive: checkArgUniqueness,
  };

  function checkArgUniqueness(parentNode: {
    arguments?: ReadonlyArray<ArgumentNode>;
  }) {
    // FIXME: https://github.com/graphql/graphql-js/issues/2203
    /* c8 ignore next */
    const argumentNodes = parentNode.arguments ?? [];

    const seenArgs = groupBy(argumentNodes, (arg) => arg.name.value);

    for (const [argName, argNodes] of seenArgs) {
      if (argNodes.length > 1) {
        context.reportError(
          new GraphQLError(
            `There can be only one argument named "${argName}".`,
            { nodes: argNodes.map((node) => node.name) },
          ),
        );
      }
    }
  }
}
