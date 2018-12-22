/**
 * Copyright (c) 2018-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
var nodejsCustomInspectSymbol = typeof Symbol === 'function' ? Symbol.for('nodejs.util.inspect.custom') : undefined;
export default nodejsCustomInspectSymbol;