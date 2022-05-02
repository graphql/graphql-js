import { parse } from 'graphql/language/parser.js';
import { buildASTSchema } from 'graphql/utilities/buildASTSchema.js';

import { bigSchemaSDL } from './fixtures.js';

const schemaAST = parse(bigSchemaSDL);

export const benchmark = {
  name: 'Build Schema from AST',
  count: 10,
  measure() {
    buildASTSchema(schemaAST, { assumeValid: true });
  },
};
