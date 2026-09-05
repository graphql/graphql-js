import { validateSchema } from 'graphql/type/validate.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';
import * as GraphQLValidation from 'graphql/validation/index.js';

import { bigSchemaSDL } from './fixtures.js';

const validateWithRules = GraphQLValidation.validateWithRules;
const schema = buildSchema(bigSchemaSDL);

export const benchmark = {
  name: 'Validate With Rules - GraphQLSchema',
  measure: () => {
    schema.__validationErrors = undefined;
    return validateWithRules?.({ schema }) ?? validateSchema(schema);
  },
};
