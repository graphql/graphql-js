/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

/**
 * Determines whether to transform modules to commonjs based on an
 * environment variable. Module import/export statements are not transformed
 * if the `BABEL_MODULES` env variable is set.
 */
module.exports = process.env.BABEL_MODULES ?
  () => ({}) :
  require('babel-plugin-transform-es2015-modules-commonjs');
