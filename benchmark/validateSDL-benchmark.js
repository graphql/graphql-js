import { parse } from 'graphql/language/parser.js';
import { validateSDL } from 'graphql/validation/validate.js';

import { bigSchemaSDL } from './fixtures.js';

const sdlAST = parse(bigSchemaSDL);

export const benchmark = {
  name: 'Validate SDL Document',
  count: 10,
  measure() {
    validateSDL(sdlAST);
  },
};
