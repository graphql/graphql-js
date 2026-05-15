import { toError } from '../jsutils/toError.ts';

import { GraphQLError } from './GraphQLError.ts';

/**
 * Ensure an unknown thrown value is represented as a GraphQLError.
 *
 * @internal
 */
export function ensureGraphQLError(rawError: unknown): GraphQLError {
  if (rawError instanceof GraphQLError) {
    return rawError;
  }

  const originalError = toError(rawError);
  return new GraphQLError(originalError.message, { originalError });
}
