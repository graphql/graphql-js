/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  FragmentSpreadNode,
  InlineFragmentNode,
  OperationTypeNode,
  SelectionSetNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import {
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from '../../type/directives.ts';

import type {
  ASTValidationContext,
  ASTVisitorFn,
} from './ASTValidationContext.ts';

/**
 * Defer and stream must not be used on mutation or subscription root fields.
 *
 * See https://spec.graphql.org/draft/#sec-Defer-And-Stream-Directives-Are-Used-On-Valid-Root-Field
 * @category Validation Rules
 
 * @internal
 */
export const DeferStreamDirectiveOnRootFieldASTVisitor: ASTVisitorFn = (
  context,
) => ({
  OperationDefinition(node) {
    if (node.operation !== 'subscription' && node.operation !== 'mutation') {
      return;
    }

    const rootOperationType = context.index
      .getRootOperationTypes()
      .get(node.operation);
    if (rootOperationType == null) {
      return;
    }

    forbidDeferStream({
      context,
      operationType: node.operation,
      rootTypeName: rootOperationType.typeName,
      selectionSet: node.selectionSet,
      visitedFragments: new Set(),
    });
  },
});

function forbidDeferStream({
  context,
  operationType,
  rootTypeName,
  selectionSet,
  visitedFragments,
}: {
  context: ASTValidationContext;
  operationType: OperationTypeNode;
  rootTypeName: string;
  selectionSet: SelectionSetNode;
  visitedFragments: Set<string>;
}): void {
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      const stream = selection.directives?.find(
        (directive) => directive.name.value === GraphQLStreamDirective.name,
      );
      if (stream != null) {
        context.reportError(
          new GraphQLError(
            `Stream directive cannot be used on root ${operationType} type "${rootTypeName}".`,
            { nodes: stream },
          ),
        );
      }
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = selection.name.value;
      if (visitedFragments.has(fragmentName)) {
        continue;
      }
      const fragment = context.getFragment(fragmentName);
      if (fragment != null) {
        const defer = getDeferDirective(selection);
        if (defer != null) {
          context.reportError(
            new GraphQLError(
              `Defer directive cannot be used on root ${operationType} type "${rootTypeName}".`,
              { nodes: defer },
            ),
          );
        }
        forbidDeferStream({
          context,
          operationType,
          rootTypeName,
          selectionSet: fragment.selectionSet,
          visitedFragments,
        });
      }
      visitedFragments.add(fragmentName);
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      const defer = getDeferDirective(selection);
      if (defer != null) {
        context.reportError(
          new GraphQLError(
            `Defer directive cannot be used on root ${operationType} type "${rootTypeName}".`,
            { nodes: defer },
          ),
        );
      }
      forbidDeferStream({
        context,
        operationType,
        rootTypeName,
        selectionSet: selection.selectionSet,
        visitedFragments,
      });
    }
  }
}

function getDeferDirective(fragment: FragmentSpreadNode | InlineFragmentNode) {
  return fragment.directives?.find(
    (directive) => directive.name.value === GraphQLDeferDirective.name,
  );
}
