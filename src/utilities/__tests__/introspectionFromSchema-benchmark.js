// @flow strict

import { parse } from '../../language/parser';
import { execute } from '../../execution/execute';

import { buildSchema } from '../buildASTSchema';
import { getIntrospectionQuery } from '../introspectionQuery';

import { bigSchemaSDL } from '../../__fixtures__';

const queryAST = parse(getIntrospectionQuery());
const schema = buildSchema(bigSchemaSDL, { assumeValid: true });

export const name = 'Execute Introspection Query';
export const count = 10;
export function measure() {
  execute(schema, queryAST);
}
