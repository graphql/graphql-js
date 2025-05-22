import { GraphQLSchema } from 'graphql/type/schema.js';
import { buildClientSchema } from 'graphql/utilities/buildClientSchema.js';

import { bigSchemaIntrospectionResult } from './fixtures.js';

const bigSchema = buildClientSchema(bigSchemaIntrospectionResult.data);

export const benchmark = {
  name: 'Recreate a GraphQLSchema',
  count: 40,
  measure() {
    // eslint-disable-next-line no-new
    new GraphQLSchema(bigSchema.toConfig());
  },
};
