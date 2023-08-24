import type { ObjMap } from '../../jsutils/ObjMap.js';

import { GraphQLError } from '../../error/GraphQLError.js';

import type {
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from '../../language/ast.js';
import { Kind } from '../../language/kinds.js';
import type { ASTVisitor } from '../../language/visitor.js';

import type { FieldGroup } from '../../execution/collectFields.js';
import { collectFields } from '../../execution/collectFields.js';

import type { ValidationContext } from '../ValidationContext.js';

function toNodes(fieldGroup: FieldGroup): ReadonlyArray<FieldNode> {
  return fieldGroup.fields.map((fieldDetails) => fieldDetails.node);
}

/**
 * Subscriptions must only include a non-introspection field.
 *
 * A GraphQL subscription is valid only if it contains a single root field and
 * that root field is not an introspection field.
 *
 * See https://spec.graphql.org/draft/#sec-Single-root-field
 */
export function SingleFieldSubscriptionsRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    OperationDefinition(node: OperationDefinitionNode) {
      if (node.operation === 'subscription') {
        const schema = context.getSchema();
        const subscriptionType = schema.getSubscriptionType();
        if (subscriptionType) {
          const operationName = node.name ? node.name.value : null;
          const variableValues: {
            [variable: string]: any;
          } = Object.create(null);
          const document = context.getDocument();
          const fragments: ObjMap<FragmentDefinitionNode> = Object.create(null);
          for (const definition of document.definitions) {
            if (definition.kind === Kind.FRAGMENT_DEFINITION) {
              fragments[definition.name.value] = definition;
            }
          }
          const { groupedFieldSet } = collectFields(
            schema,
            fragments,
            variableValues,
            subscriptionType,
            node,
          );
          if (groupedFieldSet.size > 1) {
            const fieldGroups = [...groupedFieldSet.values()];
            const extraFieldGroups = fieldGroups.slice(1);
            const extraFieldSelections = extraFieldGroups.flatMap(
              (fieldGroup) => toNodes(fieldGroup),
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
          for (const fieldGroup of groupedFieldSet.values()) {
            const fieldName = toNodes(fieldGroup)[0].name.value;
            if (fieldName.startsWith('__')) {
              context.reportError(
                new GraphQLError(
                  operationName != null
                    ? `Subscription "${operationName}" must not select an introspection top level field.`
                    : 'Anonymous Subscription must not select an introspection top level field.',
                  { nodes: toNodes(fieldGroup) },
                ),
              );
            }
          }
        }
      }
    },
  };
}
