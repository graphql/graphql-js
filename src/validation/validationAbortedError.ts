import { GraphQLError } from '../error/GraphQLError.ts';

/** @internal */
export const validationAbortedError: GraphQLError = new GraphQLError(
  'Validation aborted.',
);
