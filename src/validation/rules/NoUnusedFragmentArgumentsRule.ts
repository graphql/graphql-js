import { GraphQLError } from '../../error/GraphQLError.js';

import type { ASTVisitor } from '../../language/visitor.js';

import type { ValidationContext } from '../ValidationContext.js';

/**
 * No unused variables
 *
 * A GraphQL fragment is only valid if all arguments defined by it
 * are used within the same fragment.
 *
 * See https://spec.graphql.org/draft/#sec-All-Variables-Used
 */
export function NoUnusedFragmentArgumentsRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    FragmentDefinition(fragment) {
      const usages = context.getVariableUsages(fragment);
      const argumentNameUsed = new Set<string>(
        usages.map(({ node }) => node.name.value),
      );
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      /* c8 ignore next */
      const argumentDefinitions = fragment.arguments ?? [];
      for (const argDef of argumentDefinitions) {
        const argName = argDef.variable.name.value;
        if (!argumentNameUsed.has(argName)) {
          context.reportError(
            new GraphQLError(
              `Argument "$${argName}" is never used in fragment "${fragment.name.value}".`,
              { nodes: argDef },
            ),
          );
        }
      }
    },
  };
}
