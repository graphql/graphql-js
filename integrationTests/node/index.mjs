/* eslint-disable simple-import-sort/imports */
import assert from 'assert';
import { readFileSync } from 'fs';

import {
  experimentalExecuteIncrementally,
  graphqlSync,
  parse,
} from 'graphql-esm';
import { buildSchema } from 'graphql-esm/utilities';
import { version } from 'graphql-esm/version';

assert.deepStrictEqual(
  version + '+esm',
  JSON.parse(readFileSync('./node_modules/graphql-esm/package.json')).version,
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
