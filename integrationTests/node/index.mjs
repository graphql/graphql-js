import assert from 'node:assert';
import { readFileSync } from 'node:fs';

import { graphqlSync } from 'graphql';
import { astFromValue, buildSchema } from 'graphql/utilities';
import { version } from 'graphql/version';

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

assert.throws(() => astFromValue(true, undefined), 'Unexpected input type: ');
