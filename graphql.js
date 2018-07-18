"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.graphql = graphql;
exports.graphqlSync = graphqlSync;

var _validate = require("./type/validate");

var _parser = require("./language/parser");

var _validate2 = require("./validation/validate");

var _execute = require("./execution/execute");

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */
function graphql(argsOrSchema, source, rootValue, contextValue, variableValues, operationName, fieldResolver) {
  var _arguments = arguments;

  /* eslint-enable no-redeclare */
  // Always return a Promise for a consistent API.
  return new Promise(function (resolve) {
    return resolve( // Extract arguments from object args if provided.
    _arguments.length === 1 ? graphqlImpl(argsOrSchema.schema, argsOrSchema.source, argsOrSchema.rootValue, argsOrSchema.contextValue, argsOrSchema.variableValues, argsOrSchema.operationName, argsOrSchema.fieldResolver) : graphqlImpl(argsOrSchema, source, rootValue, contextValue, variableValues, operationName, fieldResolver));
  });
}
/**
 * The graphqlSync function also fulfills GraphQL operations by parsing,
 * validating, and executing a GraphQL document along side a GraphQL schema.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */


function graphqlSync(argsOrSchema, source, rootValue, contextValue, variableValues, operationName, fieldResolver) {
  /* eslint-enable no-redeclare */
  // Extract arguments from object args if provided.
  var result = arguments.length === 1 ? graphqlImpl(argsOrSchema.schema, argsOrSchema.source, argsOrSchema.rootValue, argsOrSchema.contextValue, argsOrSchema.variableValues, argsOrSchema.operationName, argsOrSchema.fieldResolver) : graphqlImpl(argsOrSchema, source, rootValue, contextValue, variableValues, operationName, fieldResolver); // Assert that the execution was synchronous.

  if (result.then) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }

  return result;
}

function graphqlImpl(schema, source, rootValue, contextValue, variableValues, operationName, fieldResolver) {
  // Validate Schema
  var schemaValidationErrors = (0, _validate.validateSchema)(schema);

  if (schemaValidationErrors.length > 0) {
    return {
      errors: schemaValidationErrors
    };
  } // Parse


  var document;

  try {
    document = (0, _parser.parse)(source);
  } catch (syntaxError) {
    return {
      errors: [syntaxError]
    };
  } // Validate


  var validationErrors = (0, _validate2.validate)(schema, document);

  if (validationErrors.length > 0) {
    return {
      errors: validationErrors
    };
  } // Execute


  return (0, _execute.execute)(schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver);
}