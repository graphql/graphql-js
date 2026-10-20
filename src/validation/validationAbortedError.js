import { GraphQLError } from '../error/GraphQLError';

/** @internal */
export const validationAbortedError: GraphQLError = new GraphQLError(
  'Validation aborted.',
);
