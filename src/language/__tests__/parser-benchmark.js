/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { join } from 'path';
import { readFileSync } from 'fs';
import { parse } from '../parser';

const kitchenSink = readFileSync(join(__dirname, '/kitchen-sink.graphql'), {
  encoding: 'utf8',
});

export const name = 'Parse kitchen sink';
export function measure() {
  parse(kitchenSink);
}
