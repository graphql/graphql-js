/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { join } from 'path';
import { readFileSync } from 'fs';

function readLocalFile(filename) {
  return readFileSync(join(__dirname, filename), 'utf8');
}

export const bigSchemaSDL = readLocalFile('github-schema.graphql');
export const bigSchemaIntrospectionResult = JSON.parse(
  readLocalFile('github-schema.json'),
);

export const kitchenSinkSDL = readLocalFile('schema-kitchen-sink.graphql');
export const kitchenSinkQuery = readLocalFile('kitchen-sink.graphql');
