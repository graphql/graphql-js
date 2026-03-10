import { toError } from '../jsutils/toError.js';

import { GraphQLError } from './GraphQLError.js';

/**
 * Ensure an unknown thrown value is represented as a GraphQLError.
 */
export function ensureGraphQLError(rawError: unknown): GraphQLError {
  if (rawError instanceof GraphQLError) {
    return rawError;
  }

  const originalError = toError(rawError);
  return new GraphQLError(originalError.message, { originalError });
}
