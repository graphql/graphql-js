import { parse } from '../../language/parser';
import { executeSync } from '../../execution/execute';

import { buildSchema } from '../buildASTSchema';
import { getIntrospectionQuery } from '../getIntrospectionQuery';

import { bigSchemaSDL } from '../../__fixtures__/index';

const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const document = parse(getIntrospectionQuery());

export const name = 'Execute Introspection Query';
export const count = 10;
export function measure() {
  executeSync({ schema, document });
}
