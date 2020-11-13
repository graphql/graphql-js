'use strict';

const { parse } = require('graphql/language/parser.js');
const { executeSync } = require('graphql/execution/execute.js');
const { buildSchema } = require('graphql/utilities/buildASTSchema.js');
const {
  getIntrospectionQuery,
} = require('graphql/utilities/getIntrospectionQuery.js');

const { bigSchemaSDL } = require('./fixtures.js');

const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const document = parse(getIntrospectionQuery());

module.exports = {
  name: 'Execute Introspection Query',
  count: 10,
  measure() {
    executeSync({ schema, document });
  },
};
