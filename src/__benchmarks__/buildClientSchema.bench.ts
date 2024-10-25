import { bench, describe } from 'vitest';

import { buildClientSchema } from '../utilities/buildClientSchema.js';

import { bigSchemaIntrospectionResult } from './fixtures.js';

describe('Build Schema from Introspection', () => {
  bench('build schema', () => {
    buildClientSchema(bigSchemaIntrospectionResult.data, { assumeValid: true });
  });
});
