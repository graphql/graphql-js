import { bench, describe } from 'vitest';

import { GraphQLSchema } from '../type/schema.js';

import { buildClientSchema } from '../utilities/buildClientSchema.js';

import { bigSchemaIntrospectionResult } from './fixtures.js';

const bigSchema = buildClientSchema(bigSchemaIntrospectionResult.data);

describe('Recreate a GraphQLSchema', () => {
  bench('Recreate a GraphQLSchema', () => {
    // eslint-disable-next-line no-new
    new GraphQLSchema(bigSchema.toConfig());
  });
});
