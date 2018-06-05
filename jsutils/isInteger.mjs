/**
 * Copyright (c) 2018-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */

/* eslint-disable no-redeclare */
// $FlowFixMe workaround for: https://github.com/facebook/flow/issues/4441
var isInteger = Number.isInteger || function (value) {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
};

export default isInteger;