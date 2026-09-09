/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  DirectiveNode,
  FieldNode,
  SelectionSetNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type {
  ASTValidationContext,
  ASTVisitorFn,
} from './ASTValidationContext.ts';

/**
 * Subscription operations must select exactly one non-introspection root field.
 *
 * See https://spec.graphql.org/draft/#sec-Single-root-field
 * @category Validation Rules
 
 * @internal
 */
export const SingleFieldSubscriptionsASTVisitor: ASTVisitorFn = (context) => ({
  OperationDefinition(node) {
    if (node.operation !== 'subscription') {
      return;
    }

    if (!context.index.getRootOperationTypes().has('subscription')) {
      return;
    }

    const operationName = node.name?.value ?? null;
    const groupedFieldSet = new Map<string, Array<FieldNode>>();
    const forbiddenDirectiveInstances: Array<DirectiveNode> = [];
    collectSubscriptionRootFields(
      context,
      node.selectionSet,
      new Set(),
      groupedFieldSet,
      forbiddenDirectiveInstances,
    );
    if (forbiddenDirectiveInstances.length > 0) {
      context.reportError(
        new GraphQLError(
          operationName != null
            ? `Subscription "${operationName}" must not use \`@skip\` or \`@include\` directives in the top level selection.`
            : 'Anonymous Subscription must not use `@skip` or `@include` directives in the top level selection.',
          { nodes: forbiddenDirectiveInstances },
        ),
      );
      return;
    }

    if (groupedFieldSet.size > 1) {
      const fieldDetailsLists = [...groupedFieldSet.values()];
      const extraFieldDetailsLists = fieldDetailsLists.slice(1);
      const extraFieldSelections = extraFieldDetailsLists.flat();
      context.reportError(
        new GraphQLError(
          operationName != null
            ? `Subscription "${operationName}" must select only one top level field.`
            : 'Anonymous Subscription must select only one top level field.',
          { nodes: extraFieldSelections },
        ),
      );
    }

    for (const fieldNodes of groupedFieldSet.values()) {
      const fieldName = fieldNodes[0].name.value;
      if (fieldName.startsWith('__')) {
        context.reportError(
          new GraphQLError(
            operationName != null
              ? `Subscription "${operationName}" must not select an introspection top level field.`
              : 'Anonymous Subscription must not select an introspection top level field.',
            { nodes: fieldNodes },
          ),
        );
      }
    }
  },
});

function collectSubscriptionRootFields(
  context: ASTValidationContext,
  selectionSet: SelectionSetNode,
  visitedFragmentNames: Set<string>,
  groupedFieldSet: Map<string, Array<FieldNode>>,
  forbiddenDirectiveInstances: Array<DirectiveNode>,
): void {
  for (const selection of selectionSet.selections) {
    const forbiddenDirectives = selection.directives?.filter(
      (directive) =>
        directive.name.value === 'skip' || directive.name.value === 'include',
    );
    if (forbiddenDirectives != null) {
      forbiddenDirectiveInstances.push(...forbiddenDirectives);
    }

    switch (selection.kind) {
      case Kind.FIELD: {
        const responseName = selection.alias?.value ?? selection.name.value;
        let fieldNodes = groupedFieldSet.get(responseName);
        if (fieldNodes == null) {
          fieldNodes = [];
          groupedFieldSet.set(responseName, fieldNodes);
        }
        fieldNodes.push(selection);
        break;
      }
      case Kind.INLINE_FRAGMENT:
        collectSubscriptionRootFields(
          context,
          selection.selectionSet,
          visitedFragmentNames,
          groupedFieldSet,
          forbiddenDirectiveInstances,
        );
        break;
      case Kind.FRAGMENT_SPREAD: {
        const fragmentName = selection.name.value;
        if (visitedFragmentNames.has(fragmentName)) {
          break;
        }
        visitedFragmentNames.add(fragmentName);
        const fragment = context.getFragment(fragmentName);
        if (fragment != null) {
          collectSubscriptionRootFields(
            context,
            fragment.selectionSet,
            visitedFragmentNames,
            groupedFieldSet,
            forbiddenDirectiveInstances,
          );
        }
        break;
      }
    }
  }
}
