'use strict';

const { buildSchema, graphqlSync } = require('graphql');

const schema = buildSchema('type Query { hello: String }');

const result = graphqlSync({
  schema,
  source: '{ hello }',
  rootValue: { hello: 'world' },
});

module.exports = { result };
