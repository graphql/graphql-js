/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  FragmentSpreadNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  OperationTypeNode,
  SelectionSetNode,
} from '../../language/ast.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import type { GraphQLObjectType } from '../../type/definition.ts';
import {
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from '../../type/directives.ts';

import type { ValidationContext } from '../ValidationContext.ts';

/**
 * Defer and stream directives are used on valid root field
 *
 * A GraphQL document is only valid if defer directives are not used on root mutation or subscription types.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import {
 *   validate,
 *   DeferStreamDirectiveOnRootFieldRule,
 * } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     message: String
 *   }
 *
 *   type Mutation {
 *     updateMessage: String
 *   }
 * `);
 * const invalidDocument = parse(`
 *   mutation { ... @defer { updateMessage } }
 * `);
 * const validDocument = parse(`
 *   { ... @defer { message } }
 * `);
 *
 * validate(schema, invalidDocument, [DeferStreamDirectiveOnRootFieldRule]).length; // => 1
 * validate(schema, validDocument, [DeferStreamDirectiveOnRootFieldRule]); // => []
 * ```
 */
export function DeferStreamDirectiveOnRootFieldRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    OperationDefinition(node: OperationDefinitionNode) {
      if (node.operation !== 'subscription' && node.operation !== 'mutation') {
        return;
      }
      const schema = context.getSchema();
      const rootType = schema.getRootType(node.operation);
      if (rootType) {
        forbidDeferStream({
          context,
          operationType: node.operation,
          rootType,
          selectionSet: node.selectionSet,
          visitedFragments: new Set(),
        });
      }
    },
  };
}

function forbidDeferStream({
  context,
  operationType,
  rootType,
  selectionSet,
  visitedFragments,
}: {
  context: ValidationContext;
  operationType: OperationTypeNode;
  rootType: GraphQLObjectType;
  selectionSet: SelectionSetNode;
  visitedFragments: Set<string>;
}) {
  for (const selection of selectionSet.selections) {
    if (selection.kind === 'Field') {
      const stream = selection.directives?.find(
        (d) => d.name.value === GraphQLStreamDirective.name,
      );
      if (stream) {
        context.reportError(
          new GraphQLError(
            `Stream directive cannot be used on root ${operationType} type "${rootType}".`,
            { nodes: stream },
          ),
        );
      }
    } else if (selection.kind === 'FragmentSpread') {
      const fragmentName = selection.name.value;
      if (visitedFragments.has(fragmentName)) {
        continue;
      }
      visitedFragments.add(fragmentName);
      const fragment = context.getFragment(fragmentName);
      if (fragment) {
        const defer = getDeferDirective(selection);
        if (defer !== undefined) {
          context.reportError(
            new GraphQLError(
              `Defer directive cannot be used on root ${operationType} type "${rootType}".`,
              { nodes: defer },
            ),
          );
        }
        forbidDeferStream({
          context,
          operationType,
          rootType,
          selectionSet: fragment.selectionSet,
          visitedFragments,
        });
      }
    } else if (selection.kind === 'InlineFragment') {
      const defer = getDeferDirective(selection);
      if (defer !== undefined) {
        context.reportError(
          new GraphQLError(
            `Defer directive cannot be used on root ${operationType} type "${rootType}".`,
            { nodes: defer },
          ),
        );
      }
      forbidDeferStream({
        context,
        operationType,
        rootType,
        selectionSet: selection.selectionSet,
        visitedFragments,
      });
    }
  }
}

function getDeferDirective(fragment: FragmentSpreadNode | InlineFragmentNode) {
  return fragment.directives?.find(
    (d) => d.name.value === GraphQLDeferDirective.name,
  );
}
