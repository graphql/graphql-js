import { GraphQLError } from '../../error/GraphQLError.ts';
import type { ASTVisitor } from '../../language/visitor.ts';
import type { ValidationContext } from '../ValidationContext.ts';
/**
 * No unused variables
 *
 * A GraphQL operation is only valid if all variables defined by an operation
 * are used, either directly or within a spread fragment.
 *
 * See https://spec.graphql.org/draft/#sec-All-Variables-Used
 */
export function NoUnusedVariablesRule(context: ValidationContext): ASTVisitor {
  return {
    OperationDefinition(operation) {
      const usages = context.getRecursiveVariableUsages(operation);
      const variableNameUsed = new Set<string>(
        usages.map(({ node }) => node.name.value),
      );
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      /* c8 ignore next */
      const variableDefinitions = operation.variableDefinitions ?? [];
      for (const variableDef of variableDefinitions) {
        const variableName = variableDef.variable.name.value;
        if (!variableNameUsed.has(variableName)) {
          context.reportError(
            new GraphQLError(
              operation.name
                ? `Variable "$${variableName}" is never used in operation "${operation.name.value}".`
                : `Variable "$${variableName}" is never used.`,
              { nodes: variableDef },
            ),
          );
        }
      }
    },
  };
}
