/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { coerceValue } from './coerceValue';
import type { GraphQLInputType } from '../type/definition';

/**
 * Deprecated. Use coerceValue() directly for richer information.
 */
export function isValidJSValue(
  value: mixed,
  type: GraphQLInputType,
): Array<string> {
  const errors = coerceValue(value, type).errors;
  return errors ? errors.map(error => error.message) : [];
}
