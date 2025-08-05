import { expect } from 'chai';
import { describe, it } from 'mocha';

import { instanceOf } from '../instanceOf.js';

describe('instanceOf', () => {
  it('do not throw on values without prototype', () => {
    class Foo {
      readonly __isFoo = true as const;
      get [Symbol.toStringTag]() {
        return 'Foo';
      }
    }

    expect(instanceOf(undefined, true, Foo)).to.equal(false);
    expect(instanceOf(undefined, null, Foo)).to.equal(false);
    expect(instanceOf(undefined, Object.create(null), Foo)).to.equal(false);
  });

  it('detect name clashes with older versions of this lib', () => {
    function oldVersion() {
      class Foo {}
      return Foo;
    }

    function newVersion() {
      class Foo {
        readonly __isFoo = true as const;
        get [Symbol.toStringTag]() {
          return 'Foo';
        }
      }
      return Foo;
    }

    const NewClass = newVersion();
    const OldClass = oldVersion();
    const newInstance = new NewClass();
    expect(instanceOf(newInstance.__isFoo, newInstance, NewClass)).to.equal(
      true,
    );
    expect(() => instanceOf(undefined, new OldClass(), NewClass)).to.throw();
  });

  it('allows instances to have share the same constructor name', () => {
    function getMinifiedClass(tag: string) {
      class SomeNameAfterMinification {
        readonly [tag] = true as const;
        get [Symbol.toStringTag]() {
          return tag;
        }
      }
      return SomeNameAfterMinification;
    }

    const Foo = getMinifiedClass('Foo');
    const Bar = getMinifiedClass('Bar');
    const fooInstance = new Foo();
    const barInstance = new Bar();
    expect(instanceOf(fooInstance.foo, fooInstance, Bar)).to.equal(false);
    expect(instanceOf(barInstance.bar, barInstance, Foo)).to.equal(false);

    const DuplicateOfFoo = getMinifiedClass('Foo');
    const duplicateOfFooInstance = new DuplicateOfFoo();
    expect(() =>
      instanceOf(duplicateOfFooInstance.foo, new DuplicateOfFoo(), Foo),
    ).to.throw();
    expect(() =>
      instanceOf(fooInstance.foo, fooInstance, DuplicateOfFoo),
    ).to.throw();
  });

  it('fails with descriptive error message', () => {
    function getFoo() {
      class Foo {
        readonly __isFoo = true as const;
        get [Symbol.toStringTag]() {
          return 'Foo';
        }
      }
      return Foo;
    }
    const Foo1 = getFoo();
    const Foo2 = getFoo();

    const foo1Instance = new Foo1();
    const foo2Instance = new Foo2();

    expect(() => instanceOf(foo1Instance.__isFoo, foo1Instance, Foo2)).to.throw(
      /^Cannot use Foo "{ __isFoo: true }" from another module or realm./m,
    );
    expect(() => instanceOf(foo2Instance.__isFoo, foo2Instance, Foo1)).to.throw(
      /^Cannot use Foo "{ __isFoo: true }" from another module or realm./m,
    );
  });
});
