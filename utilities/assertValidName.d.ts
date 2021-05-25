import { GraphQLError } from '../error/GraphQLError';
/**
 * Upholds the spec rules about naming.
 */
export declare function assertValidName(name: string): string;
/**
 * Returns an Error if a name is invalid.
 */
export declare function isValidNameError(
  name: string,
): GraphQLError | undefined;
