import { groupBy } from '../../jsutils/groupBy';

import { GraphQLError } from '../../error/GraphQLError';

import type { ASTVisitor } from '../../language/visitor';

import type { ASTValidationContext } from '../ValidationContext';

/**
 * Unique variable names
 *
 * A GraphQL operation is only valid if all its variables are uniquely named.
 */
export function UniqueVariableNamesRule(
  context: ASTValidationContext,
): ASTVisitor {
  return {
    OperationDefinition(operationNode) {
      // See: https://github.com/graphql/graphql-js/issues/2203
      /* c8 ignore next */
      const variableDefinitions = operationNode.variableDefinitions ?? [];

      const seenVariableDefinitions = groupBy(
        variableDefinitions,
        (node) => node.variable.name.value,
      );

      for (const [variableName, variableNodes] of seenVariableDefinitions) {
        if (variableNodes.length > 1) {
          context.reportError(
            new GraphQLError(
              `There can be only one variable named "$${variableName}".`,
              { nodes: variableNodes.map((node) => node.variable.name) },
            ),
          );
        }
      }
    },
  };
}
