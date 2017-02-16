/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

const NAME_RX = /^[_a-zA-Z][_a-zA-Z0-9]*$/;
const ERROR_PREFIX_RX = /^Error: /;

// Ensures console warnings are only issued once.
let hasWarnedAboutDunder = false;

/**
 * Upholds the spec rules about naming.
 */
export function assertValidName(
  name: string,
  isIntrospection?: boolean
): void {
  if (!name || typeof name !== 'string') {
    throw new Error(
      `Must be named. Unexpected name: ${name}.`
    );
  }
  if (!isIntrospection && name.slice(0, 2) === '__' && !hasWarnedAboutDunder) {
    hasWarnedAboutDunder = true;
    /* eslint-disable no-console */
    if (console && console.warn) {
      const error = new Error(
        `Name "${name}" must not begin with "__", which is reserved by ` +
        'GraphQL introspection. In a future release of graphql this will ' +
        'become a hard error.'
      );
      console.warn(formatWarning(error));
    }
    /* eslint-enable no-console */
  }
  if (!NAME_RX.test(name)) {
    throw new Error(
      `Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "${name}" does not.`
    );
  }
}

/**
 * Returns a human-readable warning based an the supplied Error object,
 * including stack trace information if available.
 */
export function formatWarning(error: Error): string {
  let formatted = '';
  const errorString = String(error).replace(ERROR_PREFIX_RX, '');
  const stack = error.stack;
  if (stack) {
    formatted = stack.replace(ERROR_PREFIX_RX, '');
  }
  if (formatted.indexOf(errorString) === -1) {
    formatted = errorString + '\n' + formatted;
  }
  return formatted.trim();
}
