import { parse } from 'graphql/language/parser.js';
import { validateSchema } from 'graphql/type/validate.js';
import { buildASTSchema } from 'graphql/utilities/buildASTSchema.js';
import * as GraphQLValidation from 'graphql/validation/index.js';
import { validateSDL } from 'graphql/validation/validate.js';

import { bigSchemaSDL } from './fixtures.js';

const validateWithRules = GraphQLValidation.validateWithRules;
const documentAST = parse(bigSchemaSDL);

export const benchmark = {
  name: 'Validate With Rules - SDL Document And Schema',
  measure: () =>
    (validateWithRules?.({
      documentAST,
    }) &&
      buildASTSchema(documentAST, {
        assumeValidSDL: true,
        assumeValid: true,
      })) ??
    (validateSDL(documentAST) &&
      validateSchema(buildASTSchema(documentAST, { assumeValidSDL: true }))),
};
