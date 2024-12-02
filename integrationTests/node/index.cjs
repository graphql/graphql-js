'use strict';

const assert = require('node:assert');
const { readFileSync } = require('node:fs');

const {
  experimentalExecuteIncrementally,
  graphqlSync,
  parse,
} = require('graphql');
const { buildSchema } = require('graphql/utilities');
const { version } = require('graphql/version');

assert.deepStrictEqual(
  version,
  JSON.parse(readFileSync('./node_modules/graphql/package.json')).version,
);

const schema = buildSchema('type Query { hello: String }');

let result = graphqlSync({
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

/**
 * The below test triggers a call `invariant` method during execution (by
 * passing a negative number to the `initialCount` parameter on the `@stream`
 * directive). This ensures that the `inlineInvariant` method called by our
 * build script works correctly.
 **/

const experimentalSchema = buildSchema(`
  directive @stream(initialCount: Int!) on FIELD

  type Query {
    greetings: [String]
  }
`);

result = experimentalExecuteIncrementally({
  schema: experimentalSchema,
  document: parse('{ greetings @stream(initialCount: -1) }'),
  rootValue: { greetings: ['hi', 'hello'] },
});

assert(result.errors?.[0] !== undefined);
assert(!result.errors[0].message.includes('is not defined'));
