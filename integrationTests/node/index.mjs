/* eslint-disable simple-import-sort/imports */
import assert from 'assert';
import { readFileSync } from 'fs';

import { graphqlSync } from 'graphql-esm';
import { buildSchema } from 'graphql-esm/utilities';
import { version } from 'graphql-esm/version';

assert.deepStrictEqual(
  version + '+esm',
  JSON.parse(readFileSync('./node_modules/graphql-esm/package.json')).version,
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
