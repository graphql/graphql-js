import { devAssert } from '../jsutils/devAssert.mjs';

/**
 * Given a GraphQLError, format it according to the rules described by the
 * Response Format, Errors section of the GraphQL Specification.
 */
export function formatError(error) {
  var _error$message;

  error || devAssert(false, 'Received null or undefined error.');
  const message =
    (_error$message = error.message) !== null && _error$message !== void 0
      ? _error$message
      : 'An unknown error occurred.';
  const locations = error.locations;
  const path = error.path;
  const extensions = error.extensions;
  return extensions
    ? {
        message,
        locations,
        path,
        extensions,
      }
    : {
        message,
        locations,
        path,
      };
}
/**
 * See: https://spec.graphql.org/draft/#sec-Errors
 */
