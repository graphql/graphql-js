"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = instanceOf;


// eslint-disable-next-line no-redeclare
function instanceOf(value, constructor) {
  if (value instanceof constructor) {
    return true;
  }
  if (value) {
    var valueConstructor = value.constructor;
    if (valueConstructor && valueConstructor.name === constructor.name) {
      throw new Error("Cannot use " + constructor.name + " \"" + value + "\" from another module or realm.\n\nEnsure that there is only one instance of \"graphql\" in the node_modules\ndirectory. If different versions of \"graphql\" are the dependencies of other\nrelied on modules, use \"resolutions\" to ensure only one version is installed.\n\nhttps://yarnpkg.com/en/docs/selective-version-resolutions\n\nDuplicate \"graphql\" modules cannot be used at the same time since different\nversions may have different capabilities and behavior. The data from one\nversion used in the function from another could produce confusing and\nspurious results.");
    }
  }
  return false;
} /**
   * Copyright (c) 2015-present, Facebook, Inc.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   * 
   */

/**
 * A replacement for instanceof which includes an error warning when multi-realm
 * constructors are detected.
 */