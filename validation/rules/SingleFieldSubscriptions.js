"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.singleFieldOnlyMessage = singleFieldOnlyMessage;
exports.SingleFieldSubscriptions = SingleFieldSubscriptions;

var _GraphQLError = require("../../error/GraphQLError");

/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
function singleFieldOnlyMessage(name) {
  return (name ? "Subscription \"".concat(name, "\" ") : 'Anonymous Subscription ') + 'must select only one top level field.';
}
/**
 * Subscriptions must only include one field.
 *
 * A GraphQL subscription is valid only if it contains a single root field.
 */


function SingleFieldSubscriptions(context) {
  return {
    OperationDefinition: function OperationDefinition(node) {
      if (node.operation === 'subscription') {
        if (node.selectionSet.selections.length !== 1) {
          context.reportError(new _GraphQLError.GraphQLError(singleFieldOnlyMessage(node.name && node.name.value), node.selectionSet.selections.slice(1)));
        }
      }
    }
  };
}
