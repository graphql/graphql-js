import { buildClientSchema } from 'graphql/utilities/buildClientSchema.js';

import { bigSchemaIntrospectionResult } from './fixtures.js';

export const benchmark = {
  name: 'Build Schema from Introspection',
  measure: () =>
    buildClientSchema(bigSchemaIntrospectionResult.data, { assumeValid: true }),
};
