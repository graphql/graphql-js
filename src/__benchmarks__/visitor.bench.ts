import { bench, describe } from 'vitest';

import { parse } from '../language/parser.js';
import { visit, visitInParallel } from '../language/visitor.js';

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
const visitors = new Array(50).fill(visitor);

describe('GraphQL AST Traversal Benchmarks', () => {
  bench('Visit all AST nodes', () => {
    visit(documentAST, visitor);
  });

  bench('Visit all AST nodes in parallel', () => {
    visit(documentAST, visitInParallel(visitors));
  });
});
