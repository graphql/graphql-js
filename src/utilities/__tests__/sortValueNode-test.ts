import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parseValue } from '../../language/parser';
import { print } from '../../language/printer';

import { sortValueNode } from '../sortValueNode';

describe('sortValueNode', () => {
  function expectSortedValue(source: string) {
    return expect(print(sortValueNode(parseValue(source))));
  }

  it('do not change non-object values', () => {
    expectSortedValue('1').to.equal('1');
    expectSortedValue('3.14').to.equal('3.14');
    expectSortedValue('null').to.equal('null');
    expectSortedValue('true').to.equal('true');
    expectSortedValue('false').to.equal('false');
    expectSortedValue('"cba"').to.equal('"cba"');
    expectSortedValue('"""cba"""').to.equal('"""cba"""');
    expectSortedValue('[1, 3.14, null, false, "cba"]').to.equal(
      '[1, 3.14, null, false, "cba"]',
    );
    expectSortedValue('[[1, 3.14, null, false, "cba"]]').to.equal(
      '[[1, 3.14, null, false, "cba"]]',
    );
  });

  it('sort input object fields', () => {
    expectSortedValue('{ b: 2, a: 1 }').to.equal('{a: 1, b: 2}');
    expectSortedValue('{ a: { c: 3, b: 2 } }').to.equal('{a: {b: 2, c: 3}}');
    expectSortedValue('[{ b: 2, a: 1 }, { d: 4, c: 3}]').to.equal(
      '[{a: 1, b: 2}, {c: 3, d: 4}]',
    );
    expectSortedValue(
      '{ b: { g: 7, f: 6 }, c: 3 , a: { d: 4, e: 5 } }',
    ).to.equal('{a: {d: 4, e: 5}, b: {f: 6, g: 7}, c: 3}');
  });
});
