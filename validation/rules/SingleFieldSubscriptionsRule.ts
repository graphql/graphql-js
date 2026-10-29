/** @category Validation Rules */
import type { ObjMap } from '../../jsutils/ObjMap.ts';
import { GraphQLError } from '../../error/GraphQLError.ts';
import type { FieldNode, OperationDefinitionNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import type { ASTVisitor } from '../../language/visitor.ts';
import { GraphQLDeferDirective } from '../../type/directives.ts';
import type {
  FieldDetailsList,
  FragmentDetails,
} from '../../execution/collectFields.ts';
import {
  collectFields,
  visitSelectionSets as visitSelectionSetsImpl,
} from '../../execution/collectFields.ts';
import type { VariableValues } from '../../execution/values.ts';
import type { ValidationContext } from '../ValidationContext.ts';
function toNodes(fieldDetailsList: FieldDetailsList): ReadonlyArray<FieldNode> {
  return fieldDetailsList.map((fieldDetails) => fieldDetails.node);
}
/**
 * Subscriptions must only include a non-introspection field.
 *
 * A GraphQL subscription is valid only if it contains a single root field and
 * that root field is not an introspection field.
 *
 * See https://spec.graphql.org/draft/#sec-Single-root-field
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { SingleFieldSubscriptionsRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 *
 *   type Subscription {
 *     a: String
 *     b: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   subscription { a b }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   SingleFieldSubscriptionsRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   subscription { a }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   SingleFieldSubscriptionsRule,
 * ]); // => []
 * ```
 */
export function SingleFieldSubscriptionsRule(
  context: ValidationContext,
): ASTVisitor {
  let fragments: ObjMap<FragmentDetails> | undefined;
  // Reserve traversal and directive work before visiting each selection set.
  const visitSelectionSets: typeof visitSelectionSetsImpl = (
    visitContext,
    selectionSet,
    groupedFieldSet,
    newDeferUsages,
    ...[deferUsage, fragmentVariableValues]
  ) => {
    context.spendFragmentWork(selectionSet.selections.length);
    for (const selection of selectionSet.selections) {
      const directives = selection.directives;
      if (directives !== undefined) {
        context.spendFragmentWork(directives.length);
        const defer = directives.find(
          (directive) => directive.name.value === GraphQLDeferDirective.name,
        );
        context.spendFragmentWork(defer?.arguments?.length ?? 0);
      }
    }
    visitSelectionSetsImpl(
      visitContext,
      selectionSet,
      groupedFieldSet,
      newDeferUsages,
      deferUsage,
      fragmentVariableValues,
      visitSelectionSets,
    );
  };
  return {
    OperationDefinition(node: OperationDefinitionNode) {
      if (node.operation === 'subscription') {
        const schema = context.getSchema();
        const subscriptionType = schema.getSubscriptionType();
        if (subscriptionType) {
          const operationName = node.name ? node.name.value : null;
          const variableValues: VariableValues = {
            sources: Object.create(null),
            coerced: Object.create(null),
          };
          if (!fragments) {
            fragments = Object.create(null) as ObjMap<FragmentDetails>;
            for (const definition of context.getDocument().definitions) {
              if (definition.kind === Kind.FRAGMENT_DEFINITION) {
                fragments[definition.name.value] = { definition };
              }
            }
          }
          const { groupedFieldSet, forbiddenDirectiveInstances } =
            collectFields(
              schema,
              fragments,
              variableValues,
              subscriptionType,
              node.selectionSet,
              context.hideSuggestions,
              true,
              visitSelectionSets,
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
          if (groupedFieldSet.size === 0) {
            context.reportError(
              new GraphQLError(
                operationName != null
                  ? `Subscription "${operationName}" must select one top level field.`
                  : 'Anonymous Subscription must select one top level field.',
                { nodes: node.selectionSet },
              ),
            );
          } else if (groupedFieldSet.size > 1) {
            const fieldDetailsLists = [...groupedFieldSet.values()];
            const extraFieldDetailsLists = fieldDetailsLists.slice(1);
            const extraFieldSelections = extraFieldDetailsLists.flatMap(
              (fieldDetailsList) => toNodes(fieldDetailsList),
            );
            context.reportError(
              new GraphQLError(
                operationName != null
                  ? `Subscription "${operationName}" must select only one top level field.`
                  : 'Anonymous Subscription must select only one top level field.',
                { nodes: extraFieldSelections },
              ),
            );
          }
          for (const fieldDetailsList of groupedFieldSet.values()) {
            const fieldName = toNodes(fieldDetailsList)[0].name.value;
            if (fieldName.startsWith('__')) {
              context.reportError(
                new GraphQLError(
                  operationName != null
                    ? `Subscription "${operationName}" must not select an introspection top level field.`
                    : 'Anonymous Subscription must not select an introspection top level field.',
                  { nodes: toNodes(fieldDetailsList) },
                ),
              );
            }
          }
        }
      }
    },
  };
}
