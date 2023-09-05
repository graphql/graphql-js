'use strict';

const { graphqlSync } = require('graphql/graphql.js');
const { buildSchema } = require('graphql/utilities/buildASTSchema.js');

const schema = buildSchema('type Query { hello: String! }');
const source = `{ ${'hello '.repeat(250)}}`;

module.exports = {
  name: 'Many repeated fields',
  count: 5,
  measure() {
    graphqlSync({ schema, source });
  },
};
