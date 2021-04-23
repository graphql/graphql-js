'use strict';

const { parse } = require('graphql/language/parser.js');
const { validateSDL } = require('graphql/validation/validate.js');

const { bigSchemaSDL } = require('./fixtures.js');

const sdlAST = parse(bigSchemaSDL);

module.exports = {
  name: 'Validate SDL Document',
  count: 10,
  measure() {
    validateSDL(sdlAST);
  },
};
