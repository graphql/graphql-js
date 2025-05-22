import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';
import { getIntrospectionQuery } from 'graphql/utilities/getIntrospectionQuery.js';
import { validate } from 'graphql/validation/validate.js';

import { bigSchemaSDL } from './fixtures.js';

const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const queryAST = parse(getIntrospectionQuery());

export const benchmark = {
  name: 'Validate Introspection Query',
  count: 50,
  measure() {
    validate(schema, queryAST);
  },
};
