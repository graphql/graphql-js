import { graphqlSync } from 'graphql/graphql.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';

import { bigSchemaSDL } from './fixtures.js';

const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const query = `{ ${'__typename '.repeat(2000)}}`;

export const benchmark = {
  name: 'Many repeated fields',
  count: 50,
  measure() {
    graphqlSync({
      schema,
      source: query,
    });
  },
};
