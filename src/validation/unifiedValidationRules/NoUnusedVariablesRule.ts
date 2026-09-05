/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { DocumentNode } from '../../language/ast.ts';
import { isExecutableDefinitionNode } from '../../language/predicates.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Variables defined by operations or fragment signatures must be used.
 *
 * See https://spec.graphql.org/draft/#sec-All-Variables-Used
 * @category Validation Rules
 
 * @internal
 */
export const NoUnusedVariablesASTVisitor: ASTVisitorFn = (context) => {
  if (!hasVariableDefinitions(context.document)) {
    return {};
  }

  return {
    FragmentDefinition(fragment) {
      const argumentNameUsed = new Set<string>();
      for (const { node } of context.getVariableUsages(fragment)) {
        argumentNameUsed.add(node.name.value);
      }
      const variableDefinitions = fragment.variableDefinitions;
      if (variableDefinitions == null) {
        return;
      }
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
    OperationDefinition(operation) {
      const operationVariableNameUsed = new Set<string>();
      const usages = context.getRecursiveVariableUsages(operation);
      for (const { node, fragmentVariableDefinition } of usages) {
        if (fragmentVariableDefinition == null) {
          operationVariableNameUsed.add(node.name.value);
        }
      }

      const variableDefinitions = operation.variableDefinitions;
      if (variableDefinitions == null) {
        return;
      }
      for (const variableDef of variableDefinitions) {
        const variableName = variableDef.variable.name.value;
        if (!operationVariableNameUsed.has(variableName)) {
          context.reportError(
            new GraphQLError(
              operation.name != null
                ? `Variable "$${variableName}" is never used in operation "${operation.name.value}".`
                : `Variable "$${variableName}" is never used.`,
              { nodes: variableDef },
            ),
          );
        }
      }
    },
  };
};

function hasVariableDefinitions(documentNode: DocumentNode): boolean {
  for (const definition of documentNode.definitions) {
    if (
      isExecutableDefinitionNode(definition) &&
      definition.variableDefinitions != null &&
      definition.variableDefinitions.length !== 0
    ) {
      return true;
    }
  }
  return false;
}
