import { expect } from 'chai';
import { describe, it } from 'mocha';

import inspect from '../inspect';
import invariant from '../invariant';
import nodejsCustomInspectSymbol from '../nodejsCustomInspectSymbol';

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
    expect(inspect('"')).to.equal('"\\""');
  });

  it('number', () => {
    expect(inspect(0.0)).to.equal('0');
    expect(inspect(3.14)).to.equal('3.14');
    expect(inspect(NaN)).to.equal('NaN');
    expect(inspect(Infinity)).to.equal('Infinity');
    expect(inspect(-Infinity)).to.equal('-Infinity');
  });

  it('function', () => {
    const unnamedFuncStr = inspect(
      // istanbul ignore next (Never called and used as a placeholder)
      () => invariant(false),
    );
    expect(unnamedFuncStr).to.equal('[function]');

    // istanbul ignore next (Never called and used as a placeholder)
    function namedFunc() {
      invariant(false);
    }
    expect(inspect(namedFunc)).to.equal('[function namedFunc]');
  });

  it('array', () => {
    expect(inspect([])).to.equal('[]');
    expect(inspect([null])).to.equal('[null]');
    expect(inspect([1, NaN])).to.equal('[1, NaN]');
    expect(inspect([['a', 'b'], 'c'])).to.equal('[["a", "b"], "c"]');

    expect(inspect([[[]]])).to.equal('[[[]]]');
    expect(inspect([[['a']]])).to.equal('[[[Array]]]');

    expect(inspect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])).to.equal(
      '[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]',
    );

    expect(inspect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).to.equal(
      '[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ... 1 more item]',
    );

    expect(inspect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).to.equal(
      '[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ... 2 more items]',
    );
  });

  it('object', () => {
    expect(inspect({})).to.equal('{}');
    expect(inspect({ a: 1 })).to.equal('{ a: 1 }');
    expect(inspect({ a: 1, b: 2 })).to.equal('{ a: 1, b: 2 }');
    expect(inspect({ array: [null, 0] })).to.equal('{ array: [null, 0] }');

    expect(inspect({ a: { b: {} } })).to.equal('{ a: { b: {} } }');
    expect(inspect({ a: { b: { c: 1 } } })).to.equal('{ a: { b: [Object] } }');

    const map = Object.create(null);
    map.a = true;
    map.b = null;
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

  it('custom inspect that return `this` should work', () => {
    const object = {
      inspect() {
        return this;
      },
    };

    expect(inspect(object)).to.equal('{ inspect: [function inspect] }');
  });

  it('custom symbol inspect is take precedence', () => {
    const object = {
      // istanbul ignore next (Never called and use just as a placeholder)
      inspect() {
        invariant(false);
      },
      [String(nodejsCustomInspectSymbol)]() {
        return '<custom symbol inspect>';
      },
    };

    expect(inspect(object)).to.equal('<custom symbol inspect>');
  });

  it('custom inspect returning object values', () => {
    const object = {
      inspect() {
        return { custom: 'inspect' };
      },
    };

    expect(inspect(object)).to.equal('{ custom: "inspect" }');
  });

  it('custom inspect function that uses this', () => {
    const object = {
      str: 'Hello World!',
      inspect() {
        return this.str;
      },
    };

    expect(inspect(object)).to.equal('Hello World!');
  });

  it('detect circular objects', () => {
    const obj = {};
    obj.self = obj;
    obj.deepSelf = { self: obj };

    expect(inspect(obj)).to.equal(
      '{ self: [Circular], deepSelf: { self: [Circular] } }',
    );

    const array = [];
    array[0] = array;
    array[1] = [array];

    expect(inspect(array)).to.equal('[[Circular], [[Circular]]]');

    const mixed = { array: [] };
    mixed.array[0] = mixed;

    expect(inspect(mixed)).to.equal('{ array: [[Circular]] }');

    const customA = {
      inspect: () => customB,
    };

    const customB = {
      inspect: () => customA,
    };

    expect(inspect(customA)).to.equal('[Circular]');
  });

  it('Use class names for the short form of an object', () => {
    class Foo {
      foo: string;

      constructor() {
        this.foo = 'bar';
      }
    }

    expect(inspect([[new Foo()]])).to.equal('[[[Foo]]]');

    (Foo.prototype: any)[Symbol.toStringTag] = 'Bar';
    expect(inspect([[new Foo()]])).to.equal('[[[Bar]]]');

    const objectWithoutClassName = new (function () {
      // eslint-disable-next-line no-invalid-this
      this.foo = 1;
    })();
    expect(inspect([[objectWithoutClassName]])).to.equal('[[[Object]]]');
  });
});
