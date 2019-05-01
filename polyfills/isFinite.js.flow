/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

declare function isFinite(value: mixed): boolean %checks(typeof value ===
  'number');

/* eslint-disable no-redeclare */
// $FlowFixMe workaround for: https://github.com/facebook/flow/issues/4441
const isFinite =
  Number.isFinite ||
  function(value) {
    return typeof value === 'number' && isFinite(value);
  };
export default isFinite;
