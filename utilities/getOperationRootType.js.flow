/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { GraphQLError } from '../error/GraphQLError';
import {
  type OperationDefinitionNode,
  type OperationTypeDefinitionNode,
} from '../language/ast';
import { type GraphQLSchema } from '../type/schema';
import { type GraphQLObjectType } from '../type/definition';

/**
 * Extracts the root type of the operation from the schema.
 */
export function getOperationRootType(
  schema: GraphQLSchema,
  operation: OperationDefinitionNode | OperationTypeDefinitionNode,
): GraphQLObjectType {
  switch (operation.operation) {
    case 'query':
      const queryType = schema.getQueryType();
      if (!queryType) {
        throw new GraphQLError(
          'Schema does not define the required query root type.',
          operation,
        );
      }
      return queryType;
    case 'mutation':
      const mutationType = schema.getMutationType();
      if (!mutationType) {
        throw new GraphQLError(
          'Schema is not configured for mutations.',
          operation,
        );
      }
      return mutationType;
    case 'subscription':
      const subscriptionType = schema.getSubscriptionType();
      if (!subscriptionType) {
        throw new GraphQLError(
          'Schema is not configured for subscriptions.',
          operation,
        );
      }
      return subscriptionType;
    default:
      throw new GraphQLError(
        'Can only have query, mutation and subscription operations.',
        operation,
      );
  }
}
