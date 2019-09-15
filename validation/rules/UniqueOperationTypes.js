"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.UniqueOperationTypes = UniqueOperationTypes;

var _GraphQLError = require("../../error/GraphQLError");

/**
 * Unique operation types
 *
 * A GraphQL document is only valid if it has only one type per operation.
 */
function UniqueOperationTypes(context) {
  var schema = context.getSchema();
  var definedOperationTypes = Object.create(null);
  var existingOperationTypes = schema ? {
    query: schema.getQueryType(),
    mutation: schema.getMutationType(),
    subscription: schema.getSubscriptionType()
  } : {};
  return {
    SchemaDefinition: checkOperationTypes,
    SchemaExtension: checkOperationTypes
  };

  function checkOperationTypes(node) {
    if (node.operationTypes) {
      for (var _i2 = 0, _ref2 = node.operationTypes || []; _i2 < _ref2.length; _i2++) {
        var operationType = _ref2[_i2];
        var operation = operationType.operation;
        var alreadyDefinedOperationType = definedOperationTypes[operation];

        if (existingOperationTypes[operation]) {
          context.reportError(new _GraphQLError.GraphQLError("Type for ".concat(operation, " already defined in the schema. It cannot be redefined."), operationType));
        } else if (alreadyDefinedOperationType) {
          context.reportError(new _GraphQLError.GraphQLError("There can be only one ".concat(operation, " type in schema."), [alreadyDefinedOperationType, operationType]));
        } else {
          definedOperationTypes[operation] = operationType;
        }
      }
    }

    return false;
  }
}
