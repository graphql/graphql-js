// @flow strict

import { parse, getIntrospectionQuery, buildSchema } from '../../';

import { validate } from '../validate';

import { bigSchemaSDL } from '../../__fixtures__';

const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const queryAST = parse(getIntrospectionQuery());

export const name = 'Validate Introspection Query';
export const count = 50;
export function measure() {
  validate(schema, queryAST);
}
