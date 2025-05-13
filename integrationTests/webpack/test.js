import assert from 'node:assert';

/* eslint-disable n/no-missing-import */
import { result } from './dist/main-js.js';
/* eslint-enable n/no-missing-import */

assert.deepStrictEqual(result, {
  data: {
    __proto__: null,
    hello: 'world',
  },
});

console.log('Test script: Got correct result from Webpack bundle!');
