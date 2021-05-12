import { inspect } from '../jsutils/inspect.mjs';
import { GraphQLError } from './GraphQLError.mjs';
/**
 * Given an arbitrary value, presumably thrown while attempting to execute a
 * GraphQL operation, produce a new GraphQLError aware of the location in the
 * document responsible for the original Error.
 */

export function locatedError(rawOriginalError, nodes, path) {
  var _originalError$nodes;

  // Sometimes a non-error is thrown, wrap it as an Error instance to ensure a consistent Error interface.
  const originalError =
    rawOriginalError instanceof Error
      ? rawOriginalError
      : new Error('Unexpected error value: ' + inspect(rawOriginalError)); // Note: this uses a brand-check to support GraphQL errors originating from other contexts.

  if (Array.isArray(originalError.path)) {
    // $FlowExpectedError[incompatible-return]
    return originalError;
  }

  return new GraphQLError(
    originalError.message, // $FlowFixMe[prop-missing] FIXME
    (_originalError$nodes = originalError.nodes) !== null &&
    _originalError$nodes !== void 0
      ? _originalError$nodes
      : nodes, // $FlowFixMe[prop-missing] FIXME
    originalError.source, // $FlowFixMe[prop-missing] FIXME
    originalError.positions,
    path,
    originalError,
  );
}
