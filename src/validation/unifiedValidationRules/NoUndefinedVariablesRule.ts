/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  FragmentDefinitionNode,
  OperationDefinitionNode,
  VariableNode,
} from '../../language/ast.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Variables used by an operation must be defined by that operation.
 *
 * See https://spec.graphql.org/draft/#sec-All-Variable-Uses-Defined
 * @category Validation Rules
 
 * @internal
 */
export const NoUndefinedVariablesASTVisitor: ASTVisitorFn = (context) => {
  const operations: Array<OperationDefinitionNode> = [];
  const variableUsages = new Map<
    OperationDefinitionNode | FragmentDefinitionNode,
    Array<VariableNode>
  >();
  let currentScope:
    | OperationDefinitionNode
    | FragmentDefinitionNode
    | undefined;

  return {
    OperationDefinition: {
      enter(operation) {
        operations.push(operation);
        currentScope = operation;
      },
      leave() {
        currentScope = undefined;
      },
    },
    FragmentDefinition: {
      enter(fragment) {
        currentScope = fragment;
      },
      leave() {
        currentScope = undefined;
      },
    },
    VariableDefinition: () => false,
    Variable(variable) {
      if (currentScope === undefined) {
        return;
      }
      let usages = variableUsages.get(currentScope);
      if (usages === undefined) {
        usages = [];
        variableUsages.set(currentScope, usages);
      }
      usages.push(variable);
    },
    Document: {
      leave() {
        for (const operation of operations) {
          validateOperation(operation);
        }
      },
    },
  };

  function validateOperation(operation: OperationDefinitionNode): void {
    const variableNameDefined = new Set<string>();
    const variableDefinitions = operation.variableDefinitions;
    if (variableDefinitions != null) {
      for (const node of variableDefinitions) {
        variableNameDefined.add(node.variable.name.value);
      }
    }

    validateVariableUsages(operation, operation, variableNameDefined);
    for (const fragment of context.getRecursivelyReferencedFragments(
      operation,
    )) {
      validateVariableUsages(operation, fragment, variableNameDefined);
    }
  }

  function validateVariableUsages(
    operation: OperationDefinitionNode,
    scope: OperationDefinitionNode | FragmentDefinitionNode,
    variableNameDefined: ReadonlySet<string>,
  ): void {
    let fragmentVariableNames: Set<string> | undefined;
    if (
      scope.kind === 'FragmentDefinition' &&
      scope.variableDefinitions != null
    ) {
      fragmentVariableNames = new Set();
      for (const node of scope.variableDefinitions) {
        fragmentVariableNames.add(node.variable.name.value);
      }
    }

    const usages = variableUsages.get(scope);
    if (usages == null) {
      return;
    }
    for (const node of usages) {
      const varName = node.name.value;
      if (fragmentVariableNames?.has(varName) === true) {
        continue;
      }
      if (!variableNameDefined.has(varName)) {
        context.reportError(
          new GraphQLError(
            operation.name != null
              ? `Variable "$${varName}" is not defined by operation "${operation.name.value}".`
              : `Variable "$${varName}" is not defined.`,
            { nodes: [node, operation] },
          ),
        );
      }
    }
  }
};
