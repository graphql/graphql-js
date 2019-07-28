// @flow strict

import { buildClientSchema } from '../buildClientSchema';

import { bigSchemaIntrospectionResult } from '../../__fixtures__';

export const name = 'Build Schema from Introspection';
export const count = 10;
export function measure() {
  buildClientSchema(bigSchemaIntrospectionResult.data, { assumeValid: true });
}
