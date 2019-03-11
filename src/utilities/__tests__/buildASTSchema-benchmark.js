/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { bigSchemaSDL } from '../../__fixtures__';

import { parse } from '../../';
import { buildASTSchema } from '../buildASTSchema';

const schemaAST = parse(bigSchemaSDL);

export const name = 'Build Schema from AST';
export function measure() {
  buildASTSchema(schemaAST, { assumeValid: true });
}
