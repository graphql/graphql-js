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

suite('Print AST', distRequire => {
  const { print } = distRequire('language/printer');
  const { parse } = distRequire('language/parser');

  const kitchenSink = readFileSync(join(__dirname, './kitchen-sink.graphql'), {
    encoding: 'utf8',
  });
  const kitchenSinkAST = parse(kitchenSink);
  measure('Kitchen Sink', () => print(kitchenSinkAST));

  const introspectionQueryAST = parse(getIntrospectionQuery());
  measure('Introspection Query', () => print(introspectionQueryAST));
});
