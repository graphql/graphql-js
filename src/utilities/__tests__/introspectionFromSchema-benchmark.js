// @flow strict

import { parse } from '../../language/parser';
import { execute } from '../../execution/execute';

import { buildSchema } from '../buildASTSchema';
import { getIntrospectionQuery } from '../getIntrospectionQuery';

import { bigSchemaSDL } from '../../__fixtures__';

const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const document = parse(getIntrospectionQuery());

export const name = 'Execute Introspection Query';
export const count = 10;
export function measure() {
  execute({ schema, document });
}
