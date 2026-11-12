import { describe, it } from 'node:test';

import { assert, expect } from 'chai';

import type { ObjMap } from '../../jsutils/ObjMap.ts';

import { parse } from '../../language/parser.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import { execute } from '../execute.ts';

describe('Execution result maps', () => {
  for (const asynchronous of [false, true]) {
    it(`preserves fresh null-prototype maps with ${asynchronous ? 'async' : 'sync'} fields`, async () => {
      const schema = buildSchema(`
        type Query { value: String! child: Child! }
        type Child { value: String! }
      `);
      const value = asynchronous ? () => Promise.resolve('value') : 'value';
      const rootValue = Object.freeze({
        value,
        child: Object.freeze({ value }),
      });
      const document = parse(`{
        __proto__: value
        constructor: value
        toString: value
        first: child { __proto__: value }
        second: child { __proto__: value }
      }`);
      const result = await execute({ schema, document, rootValue });
      expect(result.errors).to.equal(undefined);
      assert(result.data != null);
      const data = result.data;
      expect(Object.getPrototypeOf(data)).to.equal(null);
      expect(Object.keys(data)).to.deep.equal([
        '__proto__',
        'constructor',
        'toString',
        'first',
        'second',
      ]);
      for (const key of ['__proto__', 'constructor', 'toString']) {
        expect(Object.getOwnPropertyDescriptor(data, key)).to.deep.equal({
          value: 'value',
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      const first = data.first as ObjMap<unknown>;
      const second = data.second as ObjMap<unknown>;
      expect(Object.getPrototypeOf(first)).to.equal(null);
      expect(Object.getPrototypeOf(second)).to.equal(null);
      expect(first).not.to.equal(second);
      const alias = '__proto__';
      first[alias] = 'changed';
      expect(second[alias]).to.equal('value');
      expect(rootValue.child.value).to.equal(value);
      const repeated = await execute({ schema, document, rootValue });
      expect(repeated.data).not.to.equal(data);
      expect(repeated.errors).to.equal(undefined);
      expect(repeated.data?.first).to.deep.equal(second);
      expect(repeated.data?.first).not.to.equal(second);
    });
  }
});
