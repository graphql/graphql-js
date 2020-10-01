'use strict';

const { parse } = require('graphql/language/parser.js');
const { validate } = require('graphql/validation/validate.js');
const { buildSchema } = require('graphql/utilities/buildASTSchema.js');
const {
  getIntrospectionQuery,
} = require('graphql/utilities/getIntrospectionQuery.js');

const { bigSchemaSDL } = require('./fixtures.js');

const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const queryAST = parse(getIntrospectionQuery());

module.exports = {
  name: 'Validate Introspection Query',
  count: 50,
  measure() {
    validate(schema, queryAST);
  },
};
