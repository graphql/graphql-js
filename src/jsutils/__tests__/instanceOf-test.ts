import { expect } from 'chai';
import { describe, it } from 'mocha';

import { instanceOf } from '../instanceOf.js';

describe('instanceOf', () => {
  it('do not throw on values without prototype', () => {
    const fooSymbol: unique symbol = Symbol('Foo');
    class Foo {
      readonly __kind: symbol = fooSymbol;
      get [Symbol.toStringTag]() {
        return 'Foo';
      }
    }

    expect(instanceOf(true, fooSymbol, Foo)).to.equal(false);
    expect(instanceOf(null, fooSymbol, Foo)).to.equal(false);
    expect(instanceOf(Object.create(null), fooSymbol, Foo)).to.equal(false);
  });

  it('detect name clashes with older versions of this lib', () => {
    function oldVersion() {
      class Foo {}
      return Foo;
    }

    function newVersion() {
      const fooSymbol: unique symbol = Symbol('Foo');
      class FooClass {
        readonly __kind: symbol = fooSymbol;
        get [Symbol.toStringTag]() {
          return 'Foo';
        }
      }
      return { fooSymbol, FooClass };
    }

    const { fooSymbol: newSymbol, FooClass: NewClass } = newVersion();
    const OldClass = oldVersion();
    expect(instanceOf(new NewClass(), newSymbol, NewClass)).to.equal(true);
    expect(() => instanceOf(new OldClass(), newSymbol, NewClass)).to.throw();
  });

  it('allows instances to have share the same constructor name', () => {
    function getMinifiedClass(tag: string) {
      const someSymbol: unique symbol = Symbol(tag);
      class SomeNameAfterMinification {
        readonly __kind: symbol = someSymbol;
        get [Symbol.toStringTag]() {
          return tag;
        }
      }
      return { someSymbol, SomeNameAfterMinification };
    }

    const { someSymbol: fooSymbol, SomeNameAfterMinification: Foo } =
      getMinifiedClass('Foo');
    const { someSymbol: barSymbol, SomeNameAfterMinification: Bar } =
      getMinifiedClass('Bar');
    expect(instanceOf(new Foo(), barSymbol, Bar)).to.equal(false);
    expect(instanceOf(new Bar(), fooSymbol, Foo)).to.equal(false);

    const {
      someSymbol: duplicateOfFooSymbol,
      SomeNameAfterMinification: DuplicateOfFoo,
    } = getMinifiedClass('Foo');
    expect(() => instanceOf(new DuplicateOfFoo(), fooSymbol, Foo)).to.throw();
    expect(() => instanceOf(new Foo(), duplicateOfFooSymbol, Foo)).to.throw();
  });

  it('fails with descriptive error message', () => {
    function getFoo() {
      const fooSymbol: unique symbol = Symbol('Foo');
      class Foo {
        get [Symbol.toStringTag]() {
          return 'Foo';
        }
      }
      return { fooSymbol, Foo };
    }
    const { fooSymbol: foo1Symbol, Foo: Foo1 } = getFoo();
    const { fooSymbol: foo2Symbol, Foo: Foo2 } = getFoo();

    expect(() => instanceOf(new Foo1(), foo2Symbol, Foo2)).to.throw(
      /^Cannot use Foo "{}" from another module or realm./m,
    );
    expect(() => instanceOf(new Foo2(), foo1Symbol, Foo1)).to.throw(
      /^Cannot use Foo "{}" from another module or realm./m,
    );
  });
});
