/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from 'path';
import { readFileSync } from 'fs';
import { buildClientSchema } from '../buildClientSchema';

const schemaJSON = JSON.parse(
  readFileSync(join(__dirname, 'github-schema.json'), 'utf8'),
);

export const name = 'Build Schema from Introspection';
export function measure() {
  buildClientSchema(schemaJSON.data);
}
