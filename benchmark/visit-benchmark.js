'use strict';

const { parse } = require('graphql/language/parser.js');
const { visit } = require('graphql/language/visitor.js');

const { bigSchemaSDL } = require('./fixtures.js');

const documentAST = parse(bigSchemaSDL);

const visitor = {
  enter() {
    /* do nothing */
  },
  leave() {
    /* do nothing */
  },
};

module.exports = {
  name: 'Visit all AST nodes',
  count: 10,
  measure() {
    visit(documentAST, visitor);
  },
};
