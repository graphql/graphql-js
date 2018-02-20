/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from 'path';
import { readFileSync } from 'fs';
import { parse } from '../../';
import { buildASTSchema } from '../buildASTSchema';

const schemaAST = parse(
  readFileSync(join(__dirname, 'github-schema.graphql'), 'utf8'),
);

export const name = 'Build Schema from AST';
export function measure() {
  buildASTSchema(schemaAST);
}
