import type { ObjMap } from '../../jsutils/ObjMap';
import { GraphQLError } from '../../error/GraphQLError';

import type { ASTVisitor } from '../../language/visitor';
import type {
  OperationDefinitionNode,
  FragmentDefinitionNode,
} from '../../language/ast';
import { Kind } from '../../language/kinds';

import type { ValidationContext } from '../ValidationContext';
import type { ExecutionContext } from '../../execution/execute';
import { collectFields } from '../../execution/execute';

function fakeResolver() {
  /* noop */
}

/**
 * Subscriptions must only include a non-introspection field.
 *
 * A GraphQL subscription is valid only if it contains a single root field and
 * that root field is not an introspection field.
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
            [variable: string]: mixed,
            ...
          } = {};
          const document = context.getDocument();
          const fragments: ObjMap<FragmentDefinitionNode> = Object.create(null);
          for (const definition of document.definitions) {
            if (definition.kind === Kind.FRAGMENT_DEFINITION) {
              fragments[definition.name.value] = definition;
            }
          }
          const fakeExecutionContext: ExecutionContext = {
            schema,
            fragments,
            rootValue: undefined,
            contextValue: undefined,
            operation: node,
            variableValues,
            fieldResolver: fakeResolver,
            typeResolver: fakeResolver,
            errors: [],
          };
          const fields = collectFields(
            fakeExecutionContext,
            subscriptionType,
            node.selectionSet,
            {},
            {},
          );
          const responseKeys = Object.keys(fields);
          if (responseKeys.length > 1) {
            const extraResponseKeys = responseKeys.slice(1);
            const extraFieldSelections = extraResponseKeys.flatMap(
              (key) => fields[key],
            );
            context.reportError(
              new GraphQLError(
                operationName != null
                  ? `Subscription "${operationName}" must select only one top level field.`
                  : 'Anonymous Subscription must select only one top level field.',
                extraFieldSelections,
              ),
            );
          }
          for (const responseKey of Object.keys(fields)) {
            const field = fields[responseKey][0];
            if (field) {
              const fieldName = field.name.value;
              if (fieldName[0] === '_' && fieldName[1] === '_') {
                context.reportError(
                  new GraphQLError(
                    operationName != null
                      ? `Subscription "${operationName}" must not select an introspection top level field.`
                      : 'Anonymous Subscription must not select an introspection top level field.',
                    fields[responseKey],
                  ),
                );
              }
            }
          }
        }
      }
    },
  };
}
