/** @category Validation */

import { devAssert } from '../jsutils/devAssert';

import { GraphQLError } from '../error/GraphQLError';

import { assertName } from '../type/assertName';

/* c8 ignore start */
/**
 * Upholds the spec rules about naming. This deprecated helper is retained for
 * backwards compatibility; call `assertName` instead because assertValidName
 * will be removed in v17.
 * @param name - The GraphQL name to validate.
 * @returns The validated GraphQL name.
 * @example
 * ```ts
 * import { assertValidName } from 'graphql/utilities';
 *
 * assertValidName('User'); // => 'User'
 * assertValidName('__typename'); // throws an error
 * ```
 * @deprecated Please use `assertName` instead. Will be removed in v17
 */
export function assertValidName(name: string): string {
  const error = isValidNameError(name);
  if (error) {
    throw error;
  }
  return name;
}

/**
 * Returns an Error if a name is invalid. This deprecated helper is retained for
 * backwards compatibility; call `assertName` and catch the thrown GraphQLError
 * instead because isValidNameError will be removed in v17.
 * @param name - The GraphQL name to validate.
 * @returns A GraphQLError if the name is invalid; otherwise undefined.
 * @example
 * ```ts
 * import { isValidNameError } from 'graphql/utilities';
 *
 * isValidNameError('User'); // => undefined
 *
 * const error = isValidNameError('__typename');
 * error.message; // => 'Name "__typename" must not begin with "__", which is reserved by GraphQL introspection.'
 * ```
 * @deprecated Please use `assertName` instead. Will be removed in v17
 */
export function isValidNameError(name: string): GraphQLError | undefined {
  devAssert(typeof name === 'string', 'Expected name to be a string.');

  if (name.startsWith('__')) {
    return new GraphQLError(
      `Name "${name}" must not begin with "__", which is reserved by GraphQL introspection.`,
    );
  }

  try {
    assertName(name);
  } catch (error) {
    return error;
  }
}
/* c8 ignore stop */
