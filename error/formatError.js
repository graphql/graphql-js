import { devAssert } from "../jsutils/devAssert.js";

/**
 * Given a GraphQLError, format it according to the rules described by the
 * Response Format, Errors section of the GraphQL Specification.
 */
export function formatError(error) {
  error || devAssert(0, 'Received null or undefined error.');
  const message = error.message ?? 'An unknown error occurred.';
  const locations = error.locations;
  const path = error.path;
  const extensions = error.extensions;
  return extensions ? {
    message,
    locations,
    path,
    extensions
  } : {
    message,
    locations,
    path
  };
}
/**
 * @see https://github.com/graphql/graphql-spec/blob/master/spec/Section%207%20--%20Response.md#errors
 */
