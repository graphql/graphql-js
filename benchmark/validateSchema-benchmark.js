import { validateSchema } from 'graphql/type/validate.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';

import { bigSchemaSDL } from './fixtures.js';

const schema = buildSchema(bigSchemaSDL, {
  assumeValidSDL: true,
});

export const benchmark = {
  name: 'Validate Schema',
  measure: () => {
    // validateSchema caches results on the schema, so clear the cache to
    // measure validation itself without also measuring schema construction.
    schema.__validationErrors = undefined;
    return validateSchema(schema);
  },
};
