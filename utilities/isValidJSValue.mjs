/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */
import { coerceValue } from './coerceValue';

/**
 * Deprecated. Use coerceValue() directly for richer information.
 *
 * This function will be removed in v15
 */
export function isValidJSValue(value, type) {
  var errors = coerceValue(value, type).errors;
  return errors ? errors.map(function (error) {
    return error.message;
  }) : [];
}