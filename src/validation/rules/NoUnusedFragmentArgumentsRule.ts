import { GraphQLError } from '../../error/GraphQLError.js';

import type {
  FragmentDefinitionNode,
  SelectionSetNode,
} from '../../language/ast.js';
import type { ASTVisitor } from '../../language/visitor.js';

import type { ValidationContext } from '../ValidationContext.js';

/**
 * No unused fragment arguments
 *
 * A GraphQL document is only valid if each argument defined by a fragment
 * definition within the document is used by at least one fragment
 * spread within the document.
 *
 * See https://spec.graphql.org/draft/#sec-Fragment-Arguments-Must-Be-Used
 */
export function NoUnusedFragmentArgumentsRule(
  context: ValidationContext,
): ASTVisitor {
  const fragmentArgumentNamesUsed = new Map<
    FragmentDefinitionNode,
    Set<String>
  >();
  return {
    OperationDefinition(operation) {
      addUsedArguments(
        context,
        fragmentArgumentNamesUsed,
        operation.selectionSet,
      );
    },
    FragmentDefinition(fragment) {
      addUsedArguments(
        context,
        fragmentArgumentNamesUsed,
        fragment.selectionSet,
      );
    },
    Document: {
      leave(document) {
        for (const definition of document.definitions) {
          if (definition.kind === 'FragmentDefinition') {
            const argumentsUsedForFragment =
              fragmentArgumentNamesUsed.get(definition);
            const variableDefinitions = definition.variableDefinitions;
            if (variableDefinitions) {
              for (const variableDefinition of variableDefinitions) {
                const argumentName = variableDefinition.variable.name.value;
                if (!argumentsUsedForFragment?.has(argumentName)) {
                  context.reportError(
                    new GraphQLError(
                      `Fragment argument "${argumentName}" is not used.`,
                      { nodes: variableDefinition },
                    ),
                  );
                }
              }
            }
          }
        }
      },
    },
  };
}

function addUsedArguments(
  context: ValidationContext,
  fragmentArgumentNamesUsed: Map<FragmentDefinitionNode, Set<String>>,
  selectionSetNode: SelectionSetNode,
): void {
  const operationSpreads = context.getFragmentSpreads(selectionSetNode);
  for (const spread of operationSpreads) {
    const fragment = context.getFragment(spread.name.value);
    if (fragment) {
      let argumentsUsedForFragment = fragmentArgumentNamesUsed.get(fragment);
      if (!argumentsUsedForFragment) {
        argumentsUsedForFragment = new Set();
        fragmentArgumentNamesUsed.set(fragment, argumentsUsedForFragment);
      }
      if (spread.arguments) {
        for (const argument of spread.arguments) {
          argumentsUsedForFragment.add(argument.name.value);
        }
      }
    }
  }
}
