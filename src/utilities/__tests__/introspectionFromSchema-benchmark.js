// @flow strict

import { parse } from '../../language/parser';
import { execute } from '../../execution/execute';

import { buildSchema } from '../buildASTSchema';
import { getIntrospectionQuery } from '../getIntrospectionQuery';

import { bigSchemaSDL } from '../../__fixtures__';

const queryAST = parse(getIntrospectionQuery());
const schema = buildSchema(bigSchemaSDL, { assumeValid: true });

export const name = 'Execute Introspection Query';
export const count = 10;

/**
 * @internal 
 */
export function measure() {
  execute(schema, queryAST);
}
