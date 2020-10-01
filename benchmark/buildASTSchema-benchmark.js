'use strict';

const { parse } = require('graphql/language/parser.js');
const { buildASTSchema } = require('graphql/utilities/buildASTSchema.js');

const { bigSchemaSDL } = require('./fixtures.js');

const schemaAST = parse(bigSchemaSDL);

module.exports = {
  name: 'Build Schema from AST',
  count: 10,
  measure() {
    buildASTSchema(schemaAST, { assumeValid: true });
  },
};
