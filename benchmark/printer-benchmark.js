import { parse } from 'graphql/language/parser.js';
import { print } from 'graphql/language/printer.js';

import { bigDocumentSDL } from './fixtures.js';

const document = parse(bigDocumentSDL);

export const benchmark = {
  name: 'Print kitchen sink document',
  count: 1000,
  measure() {
    print(document);
  },
};
