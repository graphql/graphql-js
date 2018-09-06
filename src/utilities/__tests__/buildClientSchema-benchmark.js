/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { bigSchemaIntrospectionResult } from '../../__fixtures__';

import { buildClientSchema } from '../buildClientSchema';

export const name = 'Build Schema from Introspection';
export function measure() {
  buildClientSchema(bigSchemaIntrospectionResult.data, { assumeValid: true });
}
