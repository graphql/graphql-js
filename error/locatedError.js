'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.locatedError = locatedError;

var _inspect = require('../jsutils/inspect.js');

var _GraphQLError = require('./GraphQLError.js');

/**
 * Given an arbitrary value, presumably thrown while attempting to execute a
 * GraphQL operation, produce a new GraphQLError aware of the location in the
 * document responsible for the original Error.
 */
function locatedError(rawOriginalError, nodes, path) {
  var _nodes;

  // Sometimes a non-error is thrown, wrap it as an Error instance to ensure a consistent Error interface.
  const originalError =
    rawOriginalError instanceof Error
      ? rawOriginalError
      : new Error(
          'Unexpected error value: ' + (0, _inspect.inspect)(rawOriginalError),
        ); // Note: this uses a brand-check to support GraphQL errors originating from other contexts.

  if (isLocatedGraphQLError(originalError)) {
    return originalError;
  }

  return new _GraphQLError.GraphQLError(
    originalError.message,
    (_nodes = originalError.nodes) !== null && _nodes !== void 0
      ? _nodes
      : nodes,
    originalError.source,
    originalError.positions,
    path,
    originalError,
  );
}

function isLocatedGraphQLError(error) {
  return Array.isArray(error.path);
}
