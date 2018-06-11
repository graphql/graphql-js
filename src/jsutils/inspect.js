/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

/**
 * Used to print values in error messages.
 */
export default function inspect(value: mixed): string {
  return Array.isArray(value)
    ? '[' + value.map(inspect).join(', ') + ']'
    : value && typeof value === 'object'
      ? typeof value.inspect === 'function'
        ? value.inspect()
        : '{' +
          Object.keys(value)
            .map(k => `${k}: ${inspect(value[k])}`)
            .join(', ') +
          '}'
      : typeof value === 'string'
        ? '"' + value + '"'
        : String(value);
}
