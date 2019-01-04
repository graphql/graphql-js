/**
 * Copyright (c) 2018-present, Facebook, Inc.
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

function removeCommentsFromFixture(fixture) {
  return fixture.replace(/#.*/g, '');
}

export const strippedKitchenSinkSDL = removeCommentsFromFixture(
  readLocalFile('stripped-schema-kitchen-sink.graphql'),
).trim();
export const strippedKitchenSinkQuery = removeCommentsFromFixture(
  readLocalFile('stripped-kitchen-sink.graphql'),
).trim();
