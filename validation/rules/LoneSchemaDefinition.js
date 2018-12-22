"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.schemaDefinitionNotAloneMessage = schemaDefinitionNotAloneMessage;
exports.canNotDefineSchemaWithinExtensionMessage = canNotDefineSchemaWithinExtensionMessage;
exports.LoneSchemaDefinition = LoneSchemaDefinition;

var _GraphQLError = require("../../error/GraphQLError");

/**
 * Copyright (c) 2018-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
function schemaDefinitionNotAloneMessage() {
  return 'Must provide only one schema definition.';
}

function canNotDefineSchemaWithinExtensionMessage() {
  return 'Cannot define a new schema within a schema extension.';
}
/**
 * Lone Schema definition
 *
 * A GraphQL document is only valid if it contains only one schema definition.
 */


function LoneSchemaDefinition(context) {
  var oldSchema = context.getSchema();
  var alreadyDefined = oldSchema && (oldSchema.astNode || oldSchema.getQueryType() || oldSchema.getMutationType() || oldSchema.getSubscriptionType());
  var schemaDefinitionsCount = 0;
  return {
    SchemaDefinition: function SchemaDefinition(node) {
      if (alreadyDefined) {
        context.reportError(new _GraphQLError.GraphQLError(canNotDefineSchemaWithinExtensionMessage(), node));
        return;
      }

      if (schemaDefinitionsCount > 0) {
        context.reportError(new _GraphQLError.GraphQLError(schemaDefinitionNotAloneMessage(), node));
      }

      ++schemaDefinitionsCount;
    }
  };
}