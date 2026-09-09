/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  DirectiveNode,
  FragmentSpreadNode,
  SelectionSetNode,
} from '../../language/ast.ts';
import { OperationTypeNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import {
  GraphQLDeferDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLStreamDirective,
} from '../../type/directives.ts';

import type {
  ASTValidationContext,
  ASTVisitorFn,
} from './ASTValidationContext.ts';

function ifArgumentCanBeFalse(node: DirectiveNode): boolean {
  const ifArgument = node.arguments?.find((arg) => arg.name.value === 'if');
  if (ifArgument == null) {
    return false;
  }
  if (ifArgument.value.kind === Kind.BOOLEAN) {
    return !ifArgument.value.value;
  }
  return ifArgument.value.kind === Kind.VARIABLE;
}

function canBeSkippedViaSkipDirective(node: DirectiveNode): boolean {
  const ifArgument = node.arguments?.find((arg) => arg.name.value === 'if');
  if (ifArgument == null) {
    return true;
  }
  return ifArgument.value.kind !== Kind.BOOLEAN || ifArgument.value.value;
}

function canBeSkippedViaIncludeDirective(node: DirectiveNode): boolean {
  const ifArgument = node.arguments?.find((arg) => arg.name.value === 'if');
  if (ifArgument == null) {
    return false;
  }
  return ifArgument.value.kind !== Kind.BOOLEAN || !ifArgument.value.value;
}

/**
 * Defer and stream must be disabled when used on subscription operations.
 *
 * See https://spec.graphql.org/draft/#sec-Defer-And-Stream-Directives-Are-Used-On-Valid-Operations
 * @category Validation Rules
 
 * @internal
 */
export const DeferStreamDirectiveOnValidOperationsASTVisitor: ASTVisitorFn = (
  context,
) => ({
  OperationDefinition(operation) {
    if (operation.operation !== OperationTypeNode.SUBSCRIPTION) {
      return;
    }

    forbidUnconditionalDeferStream({
      context,
      selectionSet: operation.selectionSet,
      parentNodes: [],
      visitedFragments: new Set(),
    });
  },
});

function forbidUnconditionalDeferStream({
  context,
  selectionSet,
  parentNodes,
  visitedFragments,
}: {
  context: ASTValidationContext;
  selectionSet: SelectionSetNode;
  parentNodes: Array<FragmentSpreadNode>;
  visitedFragments: Set<string>;
}): void {
  for (const selection of selectionSet.selections) {
    const skip = selection.directives?.find(
      (directive) => directive.name.value === GraphQLSkipDirective.name,
    );
    if (skip != null && canBeSkippedViaSkipDirective(skip)) {
      continue;
    }

    const include = selection.directives?.find(
      (directive) => directive.name.value === GraphQLIncludeDirective.name,
    );
    if (include != null && canBeSkippedViaIncludeDirective(include)) {
      continue;
    }

    const directives = selection.directives;
    if (directives != null) {
      for (const directive of directives) {
        if (
          directive.name.value === GraphQLDeferDirective.name &&
          !ifArgumentCanBeFalse(directive)
        ) {
          context.reportError(
            new GraphQLError(
              'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
              { nodes: [directive, ...parentNodes] },
            ),
          );
        } else if (
          directive.name.value === GraphQLStreamDirective.name &&
          !ifArgumentCanBeFalse(directive)
        ) {
          context.reportError(
            new GraphQLError(
              'Stream directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
              { nodes: [directive, ...parentNodes] },
            ),
          );
        }
      }
    }

    if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = selection.name.value;
      if (visitedFragments.has(fragmentName)) {
        continue;
      }
      visitedFragments.add(fragmentName);
      const fragment = context.getFragment(fragmentName);
      if (fragment != null) {
        forbidUnconditionalDeferStream({
          context,
          parentNodes: [selection, ...parentNodes],
          selectionSet: fragment.selectionSet,
          visitedFragments,
        });
      }
    } else if (selection.selectionSet != null) {
      forbidUnconditionalDeferStream({
        context,
        selectionSet: selection.selectionSet,
        parentNodes,
        visitedFragments,
      });
    }
  }
}
