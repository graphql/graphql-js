import { expect } from 'chai';
import { describe, it } from 'mocha';

import instanceOf from '../instanceOf';

describe('instanceOf', () => {
  it('allows instances to have share the same constructor name', () => {
    function getMinifiedClass(tag: string) {
      class SomeNameAfterMinification {
        // $FlowFixMe[unsupported-syntax]
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
        // $FlowFixMe[unsupported-syntax]
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
