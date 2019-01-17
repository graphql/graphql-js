/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { bigSchemaSDL } from '../../__fixtures__';

import { parse, getIntrospectionQuery, buildSchema } from '../../';
import { validate } from '../validate';

const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const queryAST = parse(getIntrospectionQuery());

export const name = 'Validate Introspection Query';
export function measure() {
  validate(schema, queryAST);
}
