'use strict';

const assert = require('assert');

// eslint-disable-next-line node/no-missing-require
const { result } = require('./dist/main.js');

assert.deepStrictEqual(result, {
  data: {
    __proto__: null,
    hello: 'world',
  },
});
console.log('Test script: Got correct result from Webpack bundle!');
