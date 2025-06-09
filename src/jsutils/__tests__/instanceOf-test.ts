import { expect } from 'chai';
import { before, describe, it } from 'mocha';

import { setEnv } from '../../env.js';

import { instanceOf } from '../instanceOf.js';

// will pick up non-development version of instanceOf by default
const { instanceOf: defaultInstanceOf } = await import(
  `../instanceOf.js?ts${Date.now()}`
);

describe('instanceOf', () => {
  before(() => {
    setEnv('development');
  });

  it('do not throw on values without prototype', () => {
    class Foo {
      get [Symbol.toStringTag]() {
        return 'Foo';
      }
    }

    expect(instanceOf(true, Foo)).to.equal(false);
    expect(instanceOf(null, Foo)).to.equal(false);
    expect(instanceOf(Object.create(null), Foo)).to.equal(false);
  });

  it('detect name clashes with older versions of this lib when set', () => {
    function oldVersion() {
      class Foo {}
      return Foo;
    }

    function newVersion() {
      class Foo {
        get [Symbol.toStringTag]() {
          return 'Foo';
        }
      }
      return Foo;
    }

    const NewClass = newVersion();
    const OldClass = oldVersion();
    expect(instanceOf(new NewClass(), NewClass)).to.equal(true);
    expect(() => instanceOf(new OldClass(), NewClass)).to.throw();
  });

  it('ignore name clashes with older versions of this lib by default', () => {
    function oldVersion() {
      class Foo {}
      return Foo;
    }

    function newVersion() {
      class Foo {
        get [Symbol.toStringTag]() {
          return 'Foo';
        }
      }
      return Foo;
    }

    const NewClass = newVersion();
    const OldClass = oldVersion();
    expect(defaultInstanceOf(new NewClass(), NewClass)).to.equal(true);
    expect(defaultInstanceOf(new OldClass(), NewClass)).to.equal(false);
  });

  it('allows instances to have share the same constructor name', () => {
    function getMinifiedClass(tag: string) {
      class SomeNameAfterMinification {
        get [Symbol.toStringTag]() {
          return tag;
        }
      }
      return SomeNameAfterMinification;
    }

    const Foo = getMinifiedClass('Foo');
    const Bar = getMinifiedClass('Bar');
    expect(instanceOf(new Foo(), Bar)).to.equal(false);
    expect(instanceOf(new Bar(), Foo)).to.equal(false);

    const DuplicateOfFoo = getMinifiedClass('Foo');
    expect(() => instanceOf(new DuplicateOfFoo(), Foo)).to.throw();
    expect(() => instanceOf(new Foo(), DuplicateOfFoo)).to.throw();
  });

  it('fails with descriptive error message', () => {
    function getFoo() {
      class Foo {
        get [Symbol.toStringTag]() {
          return 'Foo';
        }
      }
      return Foo;
    }
    const Foo1 = getFoo();
    const Foo2 = getFoo();

    expect(() => instanceOf(new Foo1(), Foo2)).to.throw(
      /^Cannot use Foo "{}" from another module or realm./m,
    );
    expect(() => instanceOf(new Foo2(), Foo1)).to.throw(
      /^Cannot use Foo "{}" from another module or realm./m,
    );
  });
});
