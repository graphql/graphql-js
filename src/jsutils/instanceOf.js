/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

/**
 * A replacement for instanceof which includes an error warning when multi-realm
 * constructors are detected.
 */
declare function instanceOf(
  value: mixed,
  constructor: mixed,
): boolean %checks(value instanceof constructor);

// eslint-disable-next-line no-redeclare
export default function instanceOf(value, constructor) {
  if (value instanceof constructor) {
    return true;
  }
  if (value) {
    const valueConstructor = value.constructor;
    if (valueConstructor && valueConstructor.name === constructor.name) {
      throw new Error(
        `Cannot use ${constructor.name} "${value}" from another module or realm.

Ensure that there is only one instance of "graphql" in the node_modules
directory. If different versions of "graphql" are the dependencies of other
relied on modules, use "resolutions" to ensure only one version is installed.

https://yarnpkg.com/en/docs/selective-version-resolutions

Duplicate "graphql" modules cannot be used at the same time since different
versions may have different capabilities and behavior. The data from one
version used in the function from another could produce confusing and
spurious results.`,
      );
    }
  }
  return false;
}
