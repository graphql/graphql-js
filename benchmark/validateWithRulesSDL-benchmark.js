import { parse } from 'graphql/language/parser.js';
import * as GraphQLValidation from 'graphql/validation/index.js';
import { validateSDL } from 'graphql/validation/validate.js';

import { bigSchemaSDL } from './fixtures.js';

const validateWithRules = GraphQLValidation.validateWithRules;
const documentAST = parse(bigSchemaSDL);

export const benchmark = {
  name: 'Validate With Rules - SDL Document',
  measure: () =>
    validateWithRules?.({
      documentAST,
    }) ?? validateSDL(documentAST),
};
