/** @category Validation Rules */

import { groupBy } from '../../jsutils/groupBy.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/** Operation variable definitions must have unique names.
 * @internal
 */
export const UniqueVariableNamesASTVisitor: ASTVisitorFn = (context) => ({
  OperationDefinition(operationNode) {
    const variableDefinitions = operationNode.variableDefinitions;
    if (variableDefinitions == null) {
      return;
    }

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
});
