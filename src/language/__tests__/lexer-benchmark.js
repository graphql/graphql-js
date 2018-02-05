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

suite('Run lexer on a string', distRequire => {
  const { Source } = distRequire('language/source');
  const { createLexer } = distRequire('language/lexer');

  function runLexer(source) {
    const lexer = createLexer(source);
    let token;
    do {
      token = lexer.advance();
    } while (token.kind !== '<EOF>');
  }

  measure('Introspection Query', () => {
    runLexer(new Source(introspectionQuery));
  });

  measure('Kitchen Sink', () => {
    runLexer(new Source(kitchenSink));
  });

  measure('Schema Kitchen Sink', () => {
    runLexer(new Source(schemaKitchenSink));
  });
});
