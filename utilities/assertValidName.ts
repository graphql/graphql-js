import { devAssert } from '../jsutils/devAssert.ts';
import { GraphQLError } from '../error/GraphQLError.ts';
import { assertName } from '../type/assertName.ts';
/**
 * Upholds the spec rules about naming.
 * @deprecated Please use `assertName` instead. Will be removed in v17
 */
// istanbul ignore next (Deprecated code)

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
// istanbul ignore next (Deprecated code)

export function isValidNameError(name: string): GraphQLError | undefined {
  typeof name === 'string' || devAssert(false, 'Expected name to be a string.');

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
