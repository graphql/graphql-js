/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { getIntrospectionQuery } from '../../utilities/introspectionQuery';
/* global suite, measure */

function readFile(path) {
  const fullPath = join(__dirname, path);
  return readFileSync(fullPath, { encoding: 'utf8' });
}

const introspectionQuery = getIntrospectionQuery();
const kitchenSink = readFile('./kitchen-sink.graphql');
const schemaKitchenSink = readFile('./schema-kitchen-sink.graphql');

suite('Parse string to AST', distRequire => {
  const { parse } = distRequire('language/parser');

  measure('Introspection Query', () => parse(introspectionQuery));
  measure('Kitchen Sink', () => parse(kitchenSink));
  measure('Schema Kitchen Sink', () => parse(schemaKitchenSink));
});
