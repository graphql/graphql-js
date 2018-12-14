/**
 * Copyright (c) 2018-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

const nodejsCustomInspectSymbol =
  typeof Symbol === 'function'
    ? Symbol.for('nodejs.util.inspect.custom')
    : undefined;

export default nodejsCustomInspectSymbol;
