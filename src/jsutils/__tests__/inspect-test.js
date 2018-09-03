/**
 * Copyright (c) 2018-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import inspect from '../inspect';

describe('inspect', () => {
  it('undefined', () => {
    expect(inspect(undefined)).to.equal('undefined');
  });

  it('null', () => {
    expect(inspect(null)).to.equal('null');
  });

  it('boolean', () => {
    expect(inspect(true)).to.equal('true');
    expect(inspect(false)).to.equal('false');
  });

  it('string', () => {
    expect(inspect('')).to.equal('""');
    expect(inspect('abc')).to.equal('"abc"');
    expect(inspect('"')).to.equal(String.raw`"\""`);
  });

  it('number', () => {
    expect(inspect(0.0)).to.equal('0');
    expect(inspect(3.14)).to.equal('3.14');
    expect(inspect(NaN)).to.equal('NaN');
    expect(inspect(Infinity)).to.equal('Infinity');
    expect(inspect(-Infinity)).to.equal('-Infinity');
  });

  it('function', () => {
    expect(inspect(() => 0)).to.equal('[function]');

    function testFunc() {}
    expect(inspect(testFunc)).to.equal('[function testFunc]');
  });

  it('array', () => {
    expect(inspect([])).to.equal('[]');
    expect(inspect([null])).to.equal('[null]');
    expect(inspect([1, NaN])).to.equal('[1, NaN]');
    expect(inspect([['a', 'b'], 'c'])).to.equal('[["a", "b"], "c"]');
  });

  it('object', () => {
    expect(inspect({})).to.equal('{}');
    expect(inspect({ a: 1 })).to.equal('{ a: 1 }');
    expect(inspect({ a: 1, b: 2 })).to.equal('{ a: 1, b: 2 }');
    expect(inspect({ array: [null, 0] })).to.equal('{ array: [null, 0] }');

    const map = Object.create(null);
    map['a'] = true;
    map['b'] = null;
    expect(inspect(map)).to.equal('{ a: true, b: null }');
  });

  it('custom inspect', () => {
    const object = {
      inspect() {
        return '<custom inspect>';
      },
    };

    expect(inspect(object)).to.equal('<custom inspect>');
  });
});
