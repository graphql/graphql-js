import { parse } from 'graphql/language/parser.js';
import { visit, visitInParallel } from 'graphql/language/visitor.js';

import { bigSchemaSDL } from './fixtures.js';

const documentAST = parse(bigSchemaSDL);

const visitors = new Array(50).fill({
  enter() {
    /* do nothing */
  },
  leave() {
    /* do nothing */
  },
});

export const benchmark = {
  name: 'Visit all AST nodes in parallel',
  count: 10,
  measure() {
    visit(documentAST, visitInParallel(visitors));
  },
};
