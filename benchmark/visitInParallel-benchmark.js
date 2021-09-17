'use strict';

const { parse } = require('graphql/language/parser.js');
const { visit, visitInParallel } = require('graphql/language/visitor.js');

const { bigSchemaSDL } = require('./fixtures.js');

const documentAST = parse(bigSchemaSDL);

const visitors = new Array(50).fill({
  enter() {
    /* do nothing */
  },
  leave() {
    /* do nothing */
  },
});

module.exports = {
  name: 'Visit all AST nodes in parallel',
  count: 10,
  measure() {
    visit(documentAST, visitInParallel(visitors));
  },
};
