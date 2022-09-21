const assert = require('assert');
const { readFileSync } = require('fs');

const { graphqlSync } = require('graphql');
const { buildSchema } = require('graphql/utilities');
const { version } = require('graphql/version');

assert.deepStrictEqual(
  version,
  JSON.parse(readFileSync('./node_modules/graphql/package.json')).version,
);

const schema = buildSchema('type Query { hello: String }');

const result = graphqlSync({
  schema,
  source: '{ hello }',
  rootValue: { hello: 'world' },
});

assert.deepStrictEqual(result, {
  data: {
    __proto__: null,
    hello: 'world',
  },
});
