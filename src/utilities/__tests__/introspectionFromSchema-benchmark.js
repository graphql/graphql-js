// @flow strict

import { bigSchemaSDL } from '../../__fixtures__';

import { execute, parse } from '../../';
import { buildSchema } from '../buildASTSchema';
import { getIntrospectionQuery } from '../introspectionQuery';

const queryAST = parse(getIntrospectionQuery());
const schema = buildSchema(bigSchemaSDL, { assumeValid: true });

export const name = 'Execute Introspection Query';
export const count = 10;
export function measure() {
  execute(schema, queryAST);
}
