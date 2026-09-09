import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';
import { extendSchema } from 'graphql/utilities/extendSchema.js';
import { getIntrospectionQuery } from 'graphql/utilities/getIntrospectionQuery.js';
import * as GraphQLValidation from 'graphql/validation/index.js';
import { validate, validateSDL } from 'graphql/validation/validate.js';

import { bigSchemaSDL } from './fixtures.js';

const validateWithRules = GraphQLValidation.validateWithRules;
const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const extensionSDL = 'extend type Query { _benchmarkAddedField: String }';
const extensionAST = parse(extensionSDL);
const extendedSchema = extendSchema(schema, extensionAST);
const queryAST = parse(getIntrospectionQuery());
const documentAST = {
  ...extensionAST,
  definitions: extensionAST.definitions.concat(queryAST.definitions),
};

export const benchmark = {
  name: 'Validate With Rules - Executable Document With SDL',
  measure: () =>
    validateWithRules?.({
      documentAST,
      schema,
    }) ??
    validateSDL(extensionAST, schema).concat(
      validate(extendedSchema, queryAST),
    ),
};
