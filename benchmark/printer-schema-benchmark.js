import { parse } from 'graphql/language/parser.js';
import { print } from 'graphql/language/printer.js';

import { bigSchemaSDL } from './fixtures.js';

const document = parse(bigSchemaSDL);

export const benchmark = {
  name: 'Print schema document',
  measure: () => print(document),
};
