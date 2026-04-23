import { parse } from 'graphql/language/parser.js';
import { visit } from 'graphql/language/visitor.js';

import { bigSchemaSDL } from './fixtures.js';

const documentAST = parse(bigSchemaSDL);

const visitor = {
  enter() {
    /* do nothing */
  },
  leave() {
    /* do nothing */
  },
};

export const benchmark = {
  name: 'Visit all AST nodes',
  measure: () => visit(documentAST, visitor),
};
