import { groupBy } from '../../jsutils/groupBy.js';

import { GraphQLError } from '../../error/GraphQLError.js';

import type { ASTVisitor } from '../../language/visitor.js';

import type { ASTValidationContext } from '../ValidationContext.js';

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
