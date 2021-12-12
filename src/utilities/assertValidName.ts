import { devAssert } from '../jsutils/devAssert';

import { GraphQLError } from '../error/GraphQLError';

import { assertName } from '../type/assertName';

/* c8 ignore start */
/**
 * Upholds the spec rules about naming.
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
 * Returns an Error if a name is invalid.
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
