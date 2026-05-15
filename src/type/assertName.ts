/** @category Names */

import { devAssert } from '../jsutils/devAssert';

import { GraphQLError } from '../error/GraphQLError';

import { isNameContinue, isNameStart } from '../language/characterClasses';

/**
 * Upholds the spec rules about naming.
 * @param name - The GraphQL name to validate.
 * @returns The validated GraphQL name.
 * @example
 * ```ts
 * import { assertName } from 'graphql/type';
 *
 * assertName('User'); // => 'User'
 * assertName('123User'); // throws an error
 * ```
 */
export function assertName(name: string): string {
  devAssert(name != null, 'Must provide name.');
  devAssert(typeof name === 'string', 'Expected name to be a string.');

  if (name.length === 0) {
    throw new GraphQLError('Expected name to be a non-empty string.');
  }

  for (let i = 1; i < name.length; ++i) {
    if (!isNameContinue(name.charCodeAt(i))) {
      throw new GraphQLError(
        `Names must only contain [_a-zA-Z0-9] but "${name}" does not.`,
      );
    }
  }

  if (!isNameStart(name.charCodeAt(0))) {
    throw new GraphQLError(
      `Names must start with [_a-zA-Z] but "${name}" does not.`,
    );
  }

  return name;
}

/**
 * Upholds the spec rules about naming enum values.
 * @param name - The GraphQL name to validate.
 * @returns The validated GraphQL name.
 * @example
 * ```ts
 * import { assertEnumValueName } from 'graphql/type';
 *
 * assertEnumValueName('ACTIVE'); // => 'ACTIVE'
 * assertEnumValueName('true'); // throws an error
 * ```
 */
export function assertEnumValueName(name: string): string {
  if (name === 'true' || name === 'false' || name === 'null') {
    throw new GraphQLError(`Enum values cannot be named: ${name}`);
  }
  return assertName(name);
}
