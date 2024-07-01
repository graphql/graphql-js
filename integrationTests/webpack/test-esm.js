import assert from 'assert';

/* eslint-disable n/no-missing-import */
import mjs from './dist/main-mjs.cjs';
/* eslint-enable n/no-missing-import */

assert.deepStrictEqual(mjs.result, {
  data: {
    __proto__: null,
    hello: 'world',
  },
});

console.log('Test script: Got correct result from Webpack esm bundle!');
