import { executeSync } from 'graphql/execution/execute.js';
import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';
import { getIntrospectionQuery } from 'graphql/utilities/getIntrospectionQuery.js';

import { bigSchemaSDL } from './fixtures.js';

const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const document = parse(getIntrospectionQuery());

export const benchmark = {
  name: 'Execute Introspection Query',
  count: 20,
  measure() {
    executeSync({ schema, document });
  },
};
