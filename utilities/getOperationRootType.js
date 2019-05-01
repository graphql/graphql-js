"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getOperationRootType = getOperationRootType;

var _GraphQLError = require("../error/GraphQLError");

/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

/**
 * Extracts the root type of the operation from the schema.
 */
function getOperationRootType(schema, operation) {
  switch (operation.operation) {
    case 'query':
      var queryType = schema.getQueryType();

      if (!queryType) {
        throw new _GraphQLError.GraphQLError('Schema does not define the required query root type.', operation);
      }

      return queryType;

    case 'mutation':
      var mutationType = schema.getMutationType();

      if (!mutationType) {
        throw new _GraphQLError.GraphQLError('Schema is not configured for mutations.', operation);
      }

      return mutationType;

    case 'subscription':
      var subscriptionType = schema.getSubscriptionType();

      if (!subscriptionType) {
        throw new _GraphQLError.GraphQLError('Schema is not configured for subscriptions.', operation);
      }

      return subscriptionType;

    default:
      throw new _GraphQLError.GraphQLError('Can only have query, mutation and subscription operations.', operation);
  }
}