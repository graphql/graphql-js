import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';
import { getIntrospectionQuery } from 'graphql/utilities/getIntrospectionQuery.js';
import * as GraphQLValidation from 'graphql/validation/index.js';
import { validate } from 'graphql/validation/validate.js';

import { bigSchemaSDL } from './fixtures.js';

const validateWithRules = GraphQLValidation.validateWithRules;
const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const queryAST = parse(getIntrospectionQuery());

export const benchmark = {
  name: 'Validate With Rules - Executable Document',
  measure: () =>
    validateWithRules?.({
      documentAST: queryAST,
      schema,
    }) ?? validate(schema, queryAST),
};
