/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { bigSchemaSDL } from '../../__fixtures__';

import { execute, parse } from '../../';
import { buildSchema } from '../buildASTSchema';
import { getIntrospectionQuery } from '../introspectionQuery';

const queryAST = parse(getIntrospectionQuery());
const schema = buildSchema(bigSchemaSDL, { assumeValid: true });

export const name = 'Execute Introspection Query';
export function measure() {
  execute(schema, queryAST);
}
