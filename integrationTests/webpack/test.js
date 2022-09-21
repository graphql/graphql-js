import assert from 'assert';

import cjs from './dist/main-cjs.cjs';
import mjs from './dist/main-mjs.cjs';

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
