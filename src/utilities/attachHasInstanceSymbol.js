/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// eslint-disable-next-line flowtype/no-weak-types
export default function attachHasInstanceSymbol(ctor: Function): void {
  if (typeof Symbol === 'undefined' || !Symbol.for || !Symbol.hasInstance) {
    return;
  }
  const tag = `@@typeof/${ctor.name}`;

  Object.defineProperty(ctor, Symbol.hasInstance, {
    value: function $hasInstance(instance) {
      return instance && instance[Symbol.for(tag)] === true;
    },
  });

  ctor.prototype[Symbol.for(tag)] = true;
}
