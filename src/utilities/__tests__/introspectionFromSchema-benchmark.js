/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from 'path';
import { readFileSync } from 'fs';
import { execute, parse } from '../../';
import { buildASTSchema } from '../buildASTSchema';
import { getIntrospectionQuery } from '../introspectionQuery';

const queryAST = parse(getIntrospectionQuery());
const schema = buildASTSchema(
  parse(readFileSync(join(__dirname, 'github-schema.graphql'), 'utf8')),
  { assumeValid: true },
);

export const name = 'Execute Introspection Query';
export function measure() {
  execute(schema, queryAST);
}
