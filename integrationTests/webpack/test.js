import assert from 'node:assert';

/* eslint-disable n/no-missing-import */
import cjs from './dist/main-cjs.cjs';
import mjs from './dist/main-mjs.cjs';
/* eslint-enable n/no-missing-import */

assert.deepStrictEqual(cjs.result, {
  data: {
    __proto__: null,
    hello: 'world',
  },
});

assert.deepStrictEqual(mjs.result, {
  data: {
    __proto__: null,
    hello: 'world',
  },
});

console.log('Test script: Got correct result from Webpack bundle!');
