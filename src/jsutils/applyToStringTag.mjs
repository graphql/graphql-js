/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

/**
 * The `applyToStringTag()` function checks first to see if the runtime
 * supports the `Symbol` class and then if the `Symbol.toStringTag` constant
 * is defined as a `Symbol` instance. If both conditions are met, the
 * Symbol.toStringTag property is defined as a getter that returns the
 * supplied class constructor's name.
 *
 * @method applyToStringTag
 *
 * @param {Class<*>} classObject a class such as Object, String, Number but
 * typically one of your own creation through the class keyword; `class A {}`,
 * for example.
 */
export function applyToStringTag(classObject: Class<*>): void {
  const symbolType: string = typeof Symbol;
  const toStringTagType: string = typeof Symbol.toStringTag;

  if (symbolType === 'function' && toStringTagType === 'symbol') {
    Object.defineProperty(classObject.prototype, Symbol.toStringTag, {
      get() {
        return this.constructor.name;
      },
    });
  }
}

/** Support both default export and named `applyToStringTag` export */
export default applyToStringTag;
