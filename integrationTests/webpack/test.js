import assert from 'assert';

// eslint-disable-next-line import/no-unresolved, node/no-missing-import
import mainCJS from './dist/main.cjs';

assert.deepStrictEqual(mainCJS.result, {
  data: {
    __proto__: null,
    hello: 'world',
  },
});
console.log('Test script: Got correct result from Webpack bundle!');
