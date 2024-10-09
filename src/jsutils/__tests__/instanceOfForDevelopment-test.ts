import { expect } from 'chai';
import { describe, it } from 'mocha';

import { instanceOf as instanceOfForDevelopment } from '../instanceOfForDevelopment.js';

describe('instanceOfForDevelopment', () => {
  it('do not throw on values without prototype', () => {
    class Foo {
      get [Symbol.toStringTag]() {
        return 'Foo';
      }
    }

    expect(instanceOfForDevelopment(true, Foo)).to.equal(false);
    expect(instanceOfForDevelopment(null, Foo)).to.equal(false);
    expect(instanceOfForDevelopment(Object.create(null), Foo)).to.equal(false);
  });

  it('detect name clashes with older versions of this lib', () => {
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
    expect(instanceOfForDevelopment(new NewClass(), NewClass)).to.equal(true);
    expect(() => instanceOfForDevelopment(new OldClass(), NewClass)).to.throw();
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
    expect(instanceOfForDevelopment(new Foo(), Bar)).to.equal(false);
    expect(instanceOfForDevelopment(new Bar(), Foo)).to.equal(false);

    const DuplicateOfFoo = getMinifiedClass('Foo');
    expect(() =>
      instanceOfForDevelopment(new DuplicateOfFoo(), Foo),
    ).to.throw();
    expect(() =>
      instanceOfForDevelopment(new Foo(), DuplicateOfFoo),
    ).to.throw();
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

    expect(() => instanceOfForDevelopment(new Foo1(), Foo2)).to.throw(
      /^Cannot use Foo "{}" from another module or realm./m,
    );
    expect(() => instanceOfForDevelopment(new Foo2(), Foo1)).to.throw(
      /^Cannot use Foo "{}" from another module or realm./m,
    );
  });
});
