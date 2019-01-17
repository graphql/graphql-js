/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { kitchenSinkQuery } from '../../__fixtures__';
import { parse } from '../parser';

export const name = 'Parse kitchen sink';
export function measure() {
  parse(kitchenSinkQuery);
}
