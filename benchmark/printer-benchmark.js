'use strict';

const { parse } = require('graphql/language/parser.js');
const { print } = require('graphql/language/printer.js');

const { bigDocumentSDL } = require('./fixtures.js');

const document = parse(bigDocumentSDL);

module.exports = {
  name: 'Print kitchen sink document',
  count: 1000,
  measure() {
    print(document);
  },
};
