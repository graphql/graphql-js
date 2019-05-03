/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';

import {
  GraphQLScalarType,
  GraphQLBoolean,
  GraphQLID,
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLUnionType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLDeprecatedDirective,
  isType,
  isScalarType,
  isSpecifiedScalarType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isInputType,
  isOutputType,
  isLeafType,
  isCompositeType,
  isAbstractType,
  isWrappingType,
  isNullableType,
  isNamedType,
  isRequiredArgument,
  isRequiredInputField,
  isDirective,
  isSpecifiedDirective,
  assertType,
  assertScalarType,
  assertObjectType,
  assertInterfaceType,
  assertUnionType,
  assertEnumType,
  assertInputObjectType,
  assertListType,
  assertNonNullType,
  assertInputType,
  assertOutputType,
  assertLeafType,
  assertCompositeType,
  assertAbstractType,
  assertWrappingType,
  assertNullableType,
  assertNamedType,
  assertDirective,
  getNullableType,
  getNamedType,
} from '../';

const ObjectType = new GraphQLObjectType({ name: 'Object', fields: {} });
const InterfaceType = new GraphQLInterfaceType({
  name: 'Interface',
  fields: {},
});
const UnionType = new GraphQLUnionType({ name: 'Union', types: [ObjectType] });
const EnumType = new GraphQLEnumType({ name: 'Enum', values: { foo: {} } });
const InputObjectType = new GraphQLInputObjectType({
  name: 'InputObject',
  fields: {},
});
const ScalarType = new GraphQLScalarType({
  name: 'Scalar',
  serialize() {},
});
const Directive = new GraphQLDirective({
  name: 'Directive',
  locations: ['QUERY'],
});

describe('Type predicates', () => {
  describe('isType', () => {
    it('returns true for unwrapped types', () => {
      expect(isType(GraphQLString)).to.equal(true);
      expect(() => assertType(GraphQLString)).not.to.throw();
      expect(isType(ObjectType)).to.equal(true);
      expect(() => assertType(ObjectType)).not.to.throw();
    });

    it('returns true for wrapped types', () => {
      expect(isType(GraphQLNonNull(GraphQLString))).to.equal(true);
      expect(() => assertType(GraphQLNonNull(GraphQLString))).not.to.throw();
    });

    it('returns false for type classes (rather than instances)', () => {
      expect(isType(GraphQLObjectType)).to.equal(false);
      expect(() => assertType(GraphQLObjectType)).to.throw();
    });

    it('returns false for random garbage', () => {
      expect(isType({ what: 'is this' })).to.equal(false);
      expect(() => assertType({ what: 'is this' })).to.throw();
    });
  });

  describe('isScalarType', () => {
    it('returns true for spec defined scalar', () => {
      expect(isScalarType(GraphQLString)).to.equal(true);
      expect(() => assertScalarType(GraphQLString)).not.to.throw();
    });

    it('returns true for custom scalar', () => {
      expect(isScalarType(ScalarType)).to.equal(true);
      expect(() => assertScalarType(ScalarType)).not.to.throw();
    });

    it('returns false for scalar class (rather than instance)', () => {
      expect(isScalarType(GraphQLScalarType)).to.equal(false);
      expect(() => assertScalarType(GraphQLScalarType)).to.throw();
    });

    it('returns false for wrapped scalar', () => {
      expect(isScalarType(GraphQLList(ScalarType))).to.equal(false);
      expect(() => assertScalarType(GraphQLList(ScalarType))).to.throw();
    });

    it('returns false for non-scalar', () => {
      expect(isScalarType(EnumType)).to.equal(false);
      expect(() => assertScalarType(EnumType)).to.throw();
      expect(isScalarType(Directive)).to.equal(false);
      expect(() => assertScalarType(Directive)).to.throw();
    });

    it('returns false for random garbage', () => {
      expect(isScalarType({ what: 'is this' })).to.equal(false);
      expect(() => assertScalarType({ what: 'is this' })).to.throw();
    });
  });

  describe('isSpecifiedScalarType', () => {
    it('returns true for specified scalars', () => {
      expect(isSpecifiedScalarType(GraphQLString)).to.equal(true);
      expect(isSpecifiedScalarType(GraphQLInt)).to.equal(true);
      expect(isSpecifiedScalarType(GraphQLFloat)).to.equal(true);
      expect(isSpecifiedScalarType(GraphQLBoolean)).to.equal(true);
      expect(isSpecifiedScalarType(GraphQLID)).to.equal(true);
    });

    it('returns false for custom scalar', () => {
      expect(isSpecifiedScalarType(ScalarType)).to.equal(false);
    });

    it('returns false for scalar class (rather than specified instance)', () => {
      expect(isSpecifiedScalarType(GraphQLScalarType)).to.equal(false);
    });

    it('returns false for wrapped specified scalar', () => {
      expect(isSpecifiedScalarType(GraphQLList(GraphQLString))).to.equal(false);
    });

    it('returns false for non-scalar', () => {
      expect(isSpecifiedScalarType(EnumType)).to.equal(false);
      expect(isSpecifiedScalarType(Directive)).to.equal(false);
    });

    it('returns false for spec defined directive', () => {
      expect(isSpecifiedScalarType(GraphQLSkipDirective)).to.equal(false);
    });

    it('returns false for object type named like specified scalar', () => {
      const ObjectNamedLikeScalar = new GraphQLObjectType({
        name: 'String',
        fields: { serialize: { type: GraphQLString } },
      });
      expect(isSpecifiedScalarType(ObjectNamedLikeScalar)).to.equal(false);
    });

    it('returns false for random garbage', () => {
      expect(isSpecifiedScalarType({ what: 'is this' })).to.equal(false);
    });
  });

  describe('isObjectType', () => {
    it('returns true for object type', () => {
      expect(isObjectType(ObjectType)).to.equal(true);
      expect(() => assertObjectType(ObjectType)).not.to.throw();
    });

    it('returns false for wrapped object type', () => {
      expect(isObjectType(GraphQLList(ObjectType))).to.equal(false);
      expect(() => assertObjectType(GraphQLList(ObjectType))).to.throw();
    });

    it('returns false for non-object type', () => {
      expect(isObjectType(InterfaceType)).to.equal(false);
      expect(() => assertObjectType(InterfaceType)).to.throw();
    });
  });

  describe('isInterfaceType', () => {
    it('returns true for interface type', () => {
      expect(isInterfaceType(InterfaceType)).to.equal(true);
      expect(() => assertInterfaceType(InterfaceType)).not.to.throw();
    });

    it('returns false for wrapped interface type', () => {
      expect(isInterfaceType(GraphQLList(InterfaceType))).to.equal(false);
      expect(() => assertInterfaceType(GraphQLList(InterfaceType))).to.throw();
    });

    it('returns false for non-interface type', () => {
      expect(isInterfaceType(ObjectType)).to.equal(false);
      expect(() => assertInterfaceType(ObjectType)).to.throw();
    });
  });

  describe('isUnionType', () => {
    it('returns true for union type', () => {
      expect(isUnionType(UnionType)).to.equal(true);
      expect(() => assertUnionType(UnionType)).not.to.throw();
    });

    it('returns false for wrapped union type', () => {
      expect(isUnionType(GraphQLList(UnionType))).to.equal(false);
      expect(() => assertUnionType(GraphQLList(UnionType))).to.throw();
    });

    it('returns false for non-union type', () => {
      expect(isUnionType(ObjectType)).to.equal(false);
      expect(() => assertUnionType(ObjectType)).to.throw();
    });
  });

  describe('isEnumType', () => {
    it('returns true for enum type', () => {
      expect(isEnumType(EnumType)).to.equal(true);
      expect(() => assertEnumType(EnumType)).not.to.throw();
    });

    it('returns false for wrapped enum type', () => {
      expect(isEnumType(GraphQLList(EnumType))).to.equal(false);
      expect(() => assertEnumType(GraphQLList(EnumType))).to.throw();
    });

    it('returns false for non-enum type', () => {
      expect(isEnumType(ScalarType)).to.equal(false);
      expect(() => assertEnumType(ScalarType)).to.throw();
    });
  });

  describe('isInputObjectType', () => {
    it('returns true for input object type', () => {
      expect(isInputObjectType(InputObjectType)).to.equal(true);
      expect(() => assertInputObjectType(InputObjectType)).not.to.throw();
    });

    it('returns false for wrapped input object type', () => {
      expect(isInputObjectType(GraphQLList(InputObjectType))).to.equal(false);
      expect(() =>
        assertInputObjectType(GraphQLList(InputObjectType)),
      ).to.throw();
    });

    it('returns false for non-input-object type', () => {
      expect(isInputObjectType(ObjectType)).to.equal(false);
      expect(() => assertInputObjectType(ObjectType)).to.throw();
    });
  });

  describe('isListType', () => {
    it('returns true for a list wrapped type', () => {
      expect(isListType(GraphQLList(ObjectType))).to.equal(true);
      expect(() => assertListType(GraphQLList(ObjectType))).not.to.throw();
    });

    it('returns false for an unwrapped type', () => {
      expect(isListType(ObjectType)).to.equal(false);
      expect(() => assertListType(ObjectType)).to.throw();
    });

    it('returns false for a non-list wrapped type', () => {
      expect(isListType(GraphQLNonNull(GraphQLList(ObjectType)))).to.equal(
        false,
      );
      expect(() =>
        assertListType(GraphQLNonNull(GraphQLList(ObjectType))),
      ).to.throw();
    });
  });

  describe('isNonNullType', () => {
    it('returns true for a non-null wrapped type', () => {
      expect(isNonNullType(GraphQLNonNull(ObjectType))).to.equal(true);
      expect(() =>
        assertNonNullType(GraphQLNonNull(ObjectType)),
      ).not.to.throw();
    });

    it('returns false for an unwrapped type', () => {
      expect(isNonNullType(ObjectType)).to.equal(false);
      expect(() => assertNonNullType(ObjectType)).to.throw();
    });

    it('returns false for a not non-null wrapped type', () => {
      expect(isNonNullType(GraphQLList(GraphQLNonNull(ObjectType)))).to.equal(
        false,
      );
      expect(() =>
        assertNonNullType(GraphQLList(GraphQLNonNull(ObjectType))),
      ).to.throw();
    });
  });

  describe('isInputType', () => {
    function expectInputType(type) {
      expect(isInputType(type)).to.equal(true);
      expect(() => assertInputType(type)).not.to.throw();
    }

    it('returns true for an input type', () => {
      expectInputType(GraphQLString);
      expectInputType(EnumType);
      expectInputType(InputObjectType);
    });

    it('returns true for a wrapped input type', () => {
      expectInputType(GraphQLList(GraphQLString));
      expectInputType(GraphQLList(EnumType));
      expectInputType(GraphQLList(InputObjectType));

      expectInputType(GraphQLNonNull(GraphQLString));
      expectInputType(GraphQLNonNull(EnumType));
      expectInputType(GraphQLNonNull(InputObjectType));
    });

    function expectNonInputType(type) {
      expect(isInputType(type)).to.equal(false);
      expect(() => assertInputType(type)).to.throw();
    }

    it('returns false for an output type', () => {
      expectNonInputType(ObjectType);
      expectNonInputType(InterfaceType);
      expectNonInputType(UnionType);
    });

    it('returns false for a wrapped output type', () => {
      expectNonInputType(GraphQLList(ObjectType));
      expectNonInputType(GraphQLList(InterfaceType));
      expectNonInputType(GraphQLList(UnionType));

      expectNonInputType(GraphQLNonNull(ObjectType));
      expectNonInputType(GraphQLNonNull(InterfaceType));
      expectNonInputType(GraphQLNonNull(UnionType));
    });
  });

  describe('isOutputType', () => {
    function expectOutputType(type) {
      expect(isOutputType(type)).to.equal(true);
      expect(() => assertOutputType(type)).not.to.throw();
    }

    it('returns true for an output type', () => {
      expectOutputType(GraphQLString);
      expectOutputType(ObjectType);
      expectOutputType(InterfaceType);
      expectOutputType(UnionType);
      expectOutputType(EnumType);
    });

    it('returns true for a wrapped output type', () => {
      expectOutputType(GraphQLList(GraphQLString));
      expectOutputType(GraphQLList(ObjectType));
      expectOutputType(GraphQLList(InterfaceType));
      expectOutputType(GraphQLList(UnionType));
      expectOutputType(GraphQLList(EnumType));

      expectOutputType(GraphQLNonNull(GraphQLString));
      expectOutputType(GraphQLNonNull(ObjectType));
      expectOutputType(GraphQLNonNull(InterfaceType));
      expectOutputType(GraphQLNonNull(UnionType));
      expectOutputType(GraphQLNonNull(EnumType));
    });

    function expectNonOutputType(type) {
      expect(isOutputType(type)).to.equal(false);
      expect(() => assertOutputType(type)).to.throw();
    }

    it('returns false for an input type', () => {
      expectNonOutputType(InputObjectType);
    });

    it('returns false for a wrapped input type', () => {
      expectNonOutputType(GraphQLList(InputObjectType));
      expectNonOutputType(GraphQLNonNull(InputObjectType));
    });
  });

  describe('isLeafType', () => {
    it('returns true for scalar and enum types', () => {
      expect(isLeafType(ScalarType)).to.equal(true);
      expect(() => assertLeafType(ScalarType)).not.to.throw();
      expect(isLeafType(EnumType)).to.equal(true);
      expect(() => assertLeafType(EnumType)).not.to.throw();
    });

    it('returns false for wrapped leaf type', () => {
      expect(isLeafType(GraphQLList(ScalarType))).to.equal(false);
      expect(() => assertLeafType(GraphQLList(ScalarType))).to.throw();
    });

    it('returns false for non-leaf type', () => {
      expect(isLeafType(ObjectType)).to.equal(false);
      expect(() => assertLeafType(ObjectType)).to.throw();
    });

    it('returns false for wrapped non-leaf type', () => {
      expect(isLeafType(GraphQLList(ObjectType))).to.equal(false);
      expect(() => assertLeafType(GraphQLList(ObjectType))).to.throw();
    });
  });

  describe('isCompositeType', () => {
    it('returns true for object, interface, and union types', () => {
      expect(isCompositeType(ObjectType)).to.equal(true);
      expect(() => assertCompositeType(ObjectType)).not.to.throw();
      expect(isCompositeType(InterfaceType)).to.equal(true);
      expect(() => assertCompositeType(InterfaceType)).not.to.throw();
      expect(isCompositeType(UnionType)).to.equal(true);
      expect(() => assertCompositeType(UnionType)).not.to.throw();
    });

    it('returns false for wrapped composite type', () => {
      expect(isCompositeType(GraphQLList(ObjectType))).to.equal(false);
      expect(() => assertCompositeType(GraphQLList(ObjectType))).to.throw();
    });

    it('returns false for non-composite type', () => {
      expect(isCompositeType(InputObjectType)).to.equal(false);
      expect(() => assertCompositeType(InputObjectType)).to.throw();
    });

    it('returns false for wrapped non-composite type', () => {
      expect(isCompositeType(GraphQLList(InputObjectType))).to.equal(false);
      expect(() =>
        assertCompositeType(GraphQLList(InputObjectType)),
      ).to.throw();
    });
  });

  describe('isAbstractType', () => {
    it('returns true for interface and union types', () => {
      expect(isAbstractType(InterfaceType)).to.equal(true);
      expect(() => assertAbstractType(InterfaceType)).not.to.throw();
      expect(isAbstractType(UnionType)).to.equal(true);
      expect(() => assertAbstractType(UnionType)).not.to.throw();
    });

    it('returns false for wrapped abstract type', () => {
      expect(isAbstractType(GraphQLList(InterfaceType))).to.equal(false);
      expect(() => assertAbstractType(GraphQLList(InterfaceType))).to.throw();
    });

    it('returns false for non-abstract type', () => {
      expect(isAbstractType(ObjectType)).to.equal(false);
      expect(() => assertAbstractType(ObjectType)).to.throw();
    });

    it('returns false for wrapped non-abstract type', () => {
      expect(isAbstractType(GraphQLList(ObjectType))).to.equal(false);
      expect(() => assertAbstractType(GraphQLList(ObjectType))).to.throw();
    });
  });

  describe('isWrappingType', () => {
    it('returns true for list and non-null types', () => {
      expect(isWrappingType(GraphQLList(ObjectType))).to.equal(true);
      expect(() => assertWrappingType(GraphQLList(ObjectType))).not.to.throw();
      expect(isWrappingType(GraphQLNonNull(ObjectType))).to.equal(true);
      expect(() =>
        assertWrappingType(GraphQLNonNull(ObjectType)),
      ).not.to.throw();
    });

    it('returns false for unwrapped types', () => {
      expect(isWrappingType(ObjectType)).to.equal(false);
      expect(() => assertWrappingType(ObjectType)).to.throw();
    });
  });

  describe('isNullableType', () => {
    it('returns true for unwrapped types', () => {
      expect(isNullableType(ObjectType)).to.equal(true);
      expect(() => assertNullableType(ObjectType)).not.to.throw();
    });

    it('returns true for list of non-null types', () => {
      expect(isNullableType(GraphQLList(GraphQLNonNull(ObjectType)))).to.equal(
        true,
      );
      expect(() =>
        assertNullableType(GraphQLList(GraphQLNonNull(ObjectType))),
      ).not.to.throw();
    });

    it('returns false for non-null types', () => {
      expect(isNullableType(GraphQLNonNull(ObjectType))).to.equal(false);
      expect(() => assertNullableType(GraphQLNonNull(ObjectType))).to.throw();
    });
  });

  describe('getNullableType', () => {
    it('returns undefined for no type', () => {
      expect(getNullableType()).to.equal(undefined);
      expect(getNullableType(null)).to.equal(undefined);
    });

    it('returns self for a nullable type', () => {
      expect(getNullableType(ObjectType)).to.equal(ObjectType);
      const listOfObj = GraphQLList(ObjectType);
      expect(getNullableType(listOfObj)).to.equal(listOfObj);
    });

    it('unwraps non-null type', () => {
      expect(getNullableType(GraphQLNonNull(ObjectType))).to.equal(ObjectType);
    });
  });

  describe('isNamedType', () => {
    it('returns true for unwrapped types', () => {
      expect(isNamedType(ObjectType)).to.equal(true);
      expect(() => assertNamedType(ObjectType)).not.to.throw();
    });

    it('returns false for list and non-null types', () => {
      expect(isNamedType(GraphQLList(ObjectType))).to.equal(false);
      expect(() => assertNamedType(GraphQLList(ObjectType))).to.throw();
      expect(isNamedType(GraphQLNonNull(ObjectType))).to.equal(false);
      expect(() => assertNamedType(GraphQLNonNull(ObjectType))).to.throw();
    });
  });

  describe('getNamedType', () => {
    it('returns undefined for no type', () => {
      expect(getNamedType()).to.equal(undefined);
      expect(getNamedType(null)).to.equal(undefined);
    });

    it('returns self for a unwrapped type', () => {
      expect(getNamedType(ObjectType)).to.equal(ObjectType);
    });

    it('unwraps wrapper types', () => {
      expect(getNamedType(GraphQLNonNull(ObjectType))).to.equal(ObjectType);
      expect(getNamedType(GraphQLList(ObjectType))).to.equal(ObjectType);
    });

    it('unwraps deeply wrapper types', () => {
      expect(
        getNamedType(GraphQLNonNull(GraphQLList(GraphQLNonNull(ObjectType)))),
      ).to.equal(ObjectType);
    });
  });

  describe('isRequiredArgument', () => {
    it('returns true for required arguments', () => {
      const requiredArg = {
        name: 'someArg',
        type: GraphQLNonNull(GraphQLString),
      };
      expect(isRequiredArgument(requiredArg)).to.equal(true);
    });

    it('returns false for optional arguments', () => {
      const optArg1 = {
        name: 'someArg',
        type: GraphQLString,
      };
      expect(isRequiredArgument(optArg1)).to.equal(false);

      const optArg2 = {
        name: 'someArg',
        type: GraphQLString,
        defaultValue: null,
      };
      expect(isRequiredArgument(optArg2)).to.equal(false);

      const optArg3 = {
        name: 'someArg',
        type: GraphQLList(GraphQLNonNull(GraphQLString)),
      };
      expect(isRequiredArgument(optArg3)).to.equal(false);

      const optArg4 = {
        name: 'someArg',
        type: GraphQLNonNull(GraphQLString),
        defaultValue: 'default',
      };
      expect(isRequiredArgument(optArg4)).to.equal(false);
    });
  });

  describe('isRequiredInputField', () => {
    it('returns true for required input field', () => {
      const requiredField = {
        name: 'someField',
        type: GraphQLNonNull(GraphQLString),
      };
      expect(isRequiredInputField(requiredField)).to.equal(true);
    });

    it('returns false for optional input field', () => {
      const optField1 = {
        name: 'someField',
        type: GraphQLString,
      };
      expect(isRequiredInputField(optField1)).to.equal(false);

      const optField2 = {
        name: 'someField',
        type: GraphQLString,
        defaultValue: null,
      };
      expect(isRequiredInputField(optField2)).to.equal(false);

      const optField3 = {
        name: 'someField',
        type: GraphQLList(GraphQLNonNull(GraphQLString)),
      };
      expect(isRequiredInputField(optField3)).to.equal(false);

      const optField4 = {
        name: 'someField',
        type: GraphQLNonNull(GraphQLString),
        defaultValue: 'default',
      };
      expect(isRequiredInputField(optField4)).to.equal(false);
    });
  });
});

describe('Directive predicates', () => {
  describe('isDirective', () => {
    it('returns true for spec defined directive', () => {
      expect(isDirective(GraphQLSkipDirective)).to.equal(true);
      expect(() => assertDirective(GraphQLSkipDirective)).not.to.throw();
    });

    it('returns true for custom directive', () => {
      expect(isDirective(Directive)).to.equal(true);
      expect(() => assertDirective(Directive)).not.to.throw();
    });

    it('returns false for directive class (rather than instance)', () => {
      expect(isDirective(GraphQLDirective)).to.equal(false);
      expect(() => assertDirective(GraphQLDirective)).to.throw();
    });

    it('returns false for non-directive', () => {
      expect(isDirective(EnumType)).to.equal(false);
      expect(() => assertDirective(EnumType)).to.throw();
      expect(isDirective(ScalarType)).to.equal(false);
      expect(() => assertDirective(ScalarType)).to.throw();
    });

    it('returns false for random garbage', () => {
      expect(isDirective({ what: 'is this' })).to.equal(false);
      expect(() => assertDirective({ what: 'is this' })).to.throw();
    });
  });
  describe('isSpecifiedDirective', () => {
    it('returns true for specified directives', () => {
      expect(isSpecifiedDirective(GraphQLIncludeDirective)).to.equal(true);
      expect(isSpecifiedDirective(GraphQLSkipDirective)).to.equal(true);
      expect(isSpecifiedDirective(GraphQLDeprecatedDirective)).to.equal(true);
    });

    it('returns false for custom directive', () => {
      expect(isSpecifiedDirective(Directive)).to.equal(false);
    });

    it('returns false for directive class (rather than specified instance)', () => {
      expect(isSpecifiedDirective(GraphQLDirective)).to.equal(false);
    });

    it('returns false for non-directive', () => {
      expect(isSpecifiedDirective(EnumType)).to.equal(false);
      expect(isSpecifiedDirective(ScalarType)).to.equal(false);
    });

    it('returns false for spec defined scalar type', () => {
      expect(isSpecifiedDirective(GraphQLString)).to.equal(false);
    });

    it('returns false for scalar type named like specified directive', () => {
      const ScalarNamedLikeDirective = new GraphQLScalarType({
        name: 'deprecated',
        serialize: () => null,
      });
      expect(isSpecifiedDirective(ScalarNamedLikeDirective)).to.equal(false);
    });

    it('returns false for random garbage', () => {
      expect(isSpecifiedDirective({ what: 'is this' })).to.equal(false);
    });
  });
});
