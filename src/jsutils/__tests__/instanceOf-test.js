import { expect } from 'chai';
import { describe, it } from 'mocha';

import { instanceOf } from '../instanceOf';
import { SYMBOL_TO_STRING_TAG } from '../../polyfills/symbols';
import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
} from '../../type/definition';

describe('instanceOf', () => {
  it('fails with descriptive error message', () => {
    function getFoo() {
      class Foo {}
      return Foo;
    }
    const Foo1 = getFoo();
    const Foo2 = getFoo();

    expect(() => instanceOf(new Foo1(), Foo2)).to.throw(
      /^Cannot use Foo "\[object Object\]" from another module or realm./m,
    );
    expect(() => instanceOf(new Foo2(), Foo1)).to.throw(
      /^Cannot use Foo "\[object Object\]" from another module or realm./m,
    );
  });

  describe('Symbol.toStringTag', () => {
    function checkSameNameClasses(getClass) {
      const Class1 = getClass('FirstClass');
      const Class2 = getClass('SecondClass');

      expect(Class1.name).to.equal('Foo');
      expect(Class2.name).to.equal('Foo');

      expect(instanceOf(null, Class1)).to.equal(false);
      expect(instanceOf(null, Class2)).to.equal(false);

      const c1 = new Class1();
      const c2 = new Class2();

      expect(getTag(c1)).to.equal('FirstClass');
      expect(getTag(c2)).to.equal('SecondClass');

      // In these Symbol.toStringTag tests, instanceOf returns the
      // expected boolean value without throwing an error, because even
      // though Class1.name === Class2.name, the Symbol.toStringTag
      // strings of the two classes are different.
      expect(instanceOf(c1, Class1)).to.equal(true);
      expect(instanceOf(c1, Class2)).to.equal(false);
      expect(instanceOf(c2, Class1)).to.equal(false);
      expect(instanceOf(c2, Class2)).to.equal(true);
    }

    function getTag(from: any): string {
      return from[SYMBOL_TO_STRING_TAG];
    }

    it('does not fail if dynamically-defined tags differ', () => {
      checkSameNameClasses((tag) => {
        class Foo {}
        Object.defineProperty(Foo.prototype, SYMBOL_TO_STRING_TAG, {
          value: tag,
        });
        return Foo;
      });
    });

    it('does not fail if dynamically-defined tag getters differ', () => {
      checkSameNameClasses((tag) => {
        class Foo {}
        Object.defineProperty(Foo.prototype, SYMBOL_TO_STRING_TAG, {
          get() {
            return tag;
          },
        });
        return Foo;
      });
    });

    it('does not fail for anonymous classes', () => {
      checkSameNameClasses((tag) => {
        const Foo = class {};
        Object.defineProperty(Foo.prototype, SYMBOL_TO_STRING_TAG, {
          get() {
            return tag;
          },
        });
        return Foo;
      });
    });

    it('does not fail if prototype property tags differ', () => {
      checkSameNameClasses((tag) => {
        class Foo {}
        (Foo.prototype: any)[SYMBOL_TO_STRING_TAG] = tag;
        return Foo;
      });
    });

    it('does not fail if computed getter tags differ', () => {
      checkSameNameClasses((tag) => {
        class Foo {
          // $FlowFixMe[unsupported-syntax] Flow doesn't support computed properties yet
          get [SYMBOL_TO_STRING_TAG]() {
            return tag;
          }
        }
        return Foo;
      });
    });

    it('is defined for various GraphQL*Type classes', () => {
      function checkGraphQLType(constructor, expectedName) {
        expect(getTag(constructor.prototype)).to.equal(expectedName);
        const instance = Object.create(constructor.prototype);
        expect(getTag(instance)).to.equal(expectedName);
        expect(instanceOf(instance, constructor)).to.equal(true);
      }

      checkGraphQLType(GraphQLScalarType, 'GraphQLScalarType');
      checkGraphQLType(GraphQLObjectType, 'GraphQLObjectType');
      checkGraphQLType(GraphQLInterfaceType, 'GraphQLInterfaceType');
      checkGraphQLType(GraphQLUnionType, 'GraphQLUnionType');
      checkGraphQLType(GraphQLEnumType, 'GraphQLEnumType');
      checkGraphQLType(GraphQLInputObjectType, 'GraphQLInputObjectType');
    });
  });
});
