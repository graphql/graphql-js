import { GraphQLError } from '../../error/GraphQLError';

import type { ASTVisitor } from '../../language/visitor';

import type { ValidationContext } from '../ValidationContext';

/**
 * No unused variables
 *
 * A GraphQL fragment is only valid if all arguments defined by it
 * are used within the same fragment.
 *
 * See https://spec.graphql.org/draft/#sec-All-Fragment-Variables-Used
 */
export function NoUnusedFragmentVariablesRule(
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
      const variableDefinitions = fragment.variableDefinitions ?? [];
      for (const varDef of variableDefinitions) {
        const argName = varDef.variable.name.value;
        if (!argumentNameUsed.has(argName)) {
          context.reportError(
            new GraphQLError(
              `Variable "$${argName}" is never used in fragment "${fragment.name.value}".`,
              { nodes: varDef },
            ),
          );
        }
      }
    },
  };
}
