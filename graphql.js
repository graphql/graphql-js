'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.graphqlSync = exports.graphql = void 0;
const isPromise_js_1 = require('./jsutils/isPromise.js');
const parser_js_1 = require('./language/parser.js');
const validate_js_1 = require('./type/validate.js');
const validate_js_2 = require('./validation/validate.js');
const execute_js_1 = require('./execution/execute.js');
function graphql(args) {
  // Always return a Promise for a consistent API.
  return new Promise((resolve) => resolve(graphqlImpl(args)));
}
exports.graphql = graphql;
/**
 * The graphqlSync function also fulfills GraphQL operations by parsing,
 * validating, and executing a GraphQL document along side a GraphQL schema.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */
function graphqlSync(args) {
  const result = graphqlImpl(args);
  // Assert that the execution was synchronous.
  if ((0, isPromise_js_1.isPromise)(result)) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }
  return result;
}
exports.graphqlSync = graphqlSync;
function graphqlImpl(args) {
  const {
    schema,
    source,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  } = args;
  // Validate Schema
  const schemaValidationErrors = (0, validate_js_1.validateSchema)(schema);
  if (schemaValidationErrors.length > 0) {
    return { errors: schemaValidationErrors };
  }
  // Parse
  let document;
  try {
    document = (0, parser_js_1.parse)(source);
  } catch (syntaxError) {
    return { errors: [syntaxError] };
  }
  // Validate
  const validationErrors = (0, validate_js_2.validate)(schema, document);
  if (validationErrors.length > 0) {
    return { errors: validationErrors };
  }
  // Execute
  return (0, execute_js_1.execute)({
    schema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  });
}
