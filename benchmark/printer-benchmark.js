'use strict';

const { parse } = require('graphql/language/parser.js');
const { print } = require('graphql/language/printer.js');
const { bigDocument } = require('./fixtures')

const document = parse(bigDocument)

module.exports = {
  name: 'Print ktichen-sink query',
  count: 1000,
  measure() {
    print(document);
  },
};
