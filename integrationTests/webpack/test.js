import assert from 'assert';

/* eslint-disable n/no-missing-import */
import cjs from './dist/main-cjs.cjs';
/* eslint-enable n/no-missing-import */

assert.deepStrictEqual(cjs.result, {
  data: {
    __proto__: null,
    hello: 'world',
  },
});

console.log('Test script: Got correct result from Webpack cjs bundle!');
