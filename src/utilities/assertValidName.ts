import { devAssert } from '../jsutils/devAssert';

import { GraphQLError } from '../error/GraphQLError';
import { isNameStart, isNameContinue } from '../language/characterClasses';

/**
 * Upholds the spec rules about naming.
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
 */
export function isValidNameError(name: string): GraphQLError | undefined {
  devAssert(typeof name === 'string', 'Expected name to be a string.');

  if (name.startsWith('__')) {
    return new GraphQLError(
      `Name "${name}" must not begin with "__", which is reserved by GraphQL introspection.`,
    );
  }

  if (name.length === 0) {
    return new GraphQLError('Expected name to be a non-empty string.');
  }

  for (let i = 1; i < name.length; ++i) {
    if (!isNameContinue(name.charCodeAt(i))) {
      return new GraphQLError(
        `Names must only contain [_a-zA-Z0-9] but "${name}" does not.`,
      );
    }
  }

  if (!isNameStart(name.charCodeAt(0))) {
    return new GraphQLError(
      `Names must start with [_a-zA-Z] but "${name}" does not.`,
    );
  }
}
