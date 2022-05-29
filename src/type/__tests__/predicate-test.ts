import { expect } from 'chai';
import { describe, it } from 'mocha';

import { DirectiveLocation } from '../../language/directiveLocation';

import type {
  GraphQLArgument,
  GraphQLInputField,
  GraphQLInputType,
} from '../definition';
import {
  assertAbstractType,
  assertCompositeType,
  assertEnumType,
  assertInputObjectType,
  assertInputType,
  assertInterfaceType,
  assertLeafType,
  assertListType,
  assertNamedType,
  assertNonNullType,
  assertNullableType,
  assertObjectType,
  assertOutputType,
  assertScalarType,
  assertType,
  assertUnionType,
  assertWrappingType,
  getNamedType,
  getNullableType,
  GraphQLEnumTypeImpl,
  GraphQLInputObjectTypeImpl,
  GraphQLInterfaceTypeImpl,
  GraphQLListImpl,
  GraphQLNonNullImpl,
  GraphQLObjectTypeImpl,
  GraphQLScalarTypeImpl,
  GraphQLUnionTypeImpl,
  isAbstractType,
  isCompositeType,
  isEnumType,
  isInputObjectType,
  isInputType,
  isInterfaceType,
  isLeafType,
  isListType,
  isNamedType,
  isNonNullType,
  isNullableType,
  isObjectType,
  isOutputType,
  isRequiredArgument,
  isRequiredInputField,
  isScalarType,
  isType,
  isUnionType,
  isWrappingType,
} from '../definition';
import {
  assertDirective,
  GraphQLDeprecatedDirective,
  GraphQLDirectiveImpl,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  isDirective,
  isSpecifiedDirective,
} from '../directives';
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
  isSpecifiedScalarType,
} from '../scalars';

const ObjectType = new GraphQLObjectTypeImpl({ name: 'Object', fields: {} });
const InterfaceType = new GraphQLInterfaceTypeImpl({
  name: 'Interface',
  fields: {},
});
const UnionType = new GraphQLUnionTypeImpl({
  name: 'Union',
  types: [ObjectType],
});
const EnumType = new GraphQLEnumTypeImpl({ name: 'Enum', values: { foo: {} } });
const InputObjectType = new GraphQLInputObjectTypeImpl({
  name: 'InputObject',
  fields: {},
});
const ScalarType = new GraphQLScalarTypeImpl({ name: 'Scalar' });
const Directive = new GraphQLDirectiveImpl({
  name: 'Directive',
  locations: [DirectiveLocation.QUERY],
});

describe('Type predicates', () => {
  describe('isType', () => {
    it('returns true for unwrapped types', () => {
      expect(isType(GraphQLString)).to.equal(true);
      expect(() => assertType(GraphQLString)).to.not.throw();
      expect(isType(ObjectType)).to.equal(true);
      expect(() => assertType(ObjectType)).to.not.throw();
    });

    it('returns true for wrapped types', () => {
      expect(isType(new GraphQLNonNullImpl(GraphQLString))).to.equal(true);
      expect(() =>
        assertType(new GraphQLNonNullImpl(GraphQLString)),
      ).to.not.throw();
    });

    it('returns false for type classes (rather than instances)', () => {
      expect(isType(GraphQLObjectTypeImpl)).to.equal(false);
      expect(() => assertType(GraphQLObjectTypeImpl)).to.throw();
    });

    it('returns false for random garbage', () => {
      expect(isType({ what: 'is this' })).to.equal(false);
      expect(() => assertType({ what: 'is this' })).to.throw();
    });
  });

  describe('isScalarType', () => {
    it('returns true for spec defined scalar', () => {
      expect(isScalarType(GraphQLString)).to.equal(true);
      expect(() => assertScalarType(GraphQLString)).to.not.throw();
    });

    it('returns true for custom scalar', () => {
      expect(isScalarType(ScalarType)).to.equal(true);
      expect(() => assertScalarType(ScalarType)).to.not.throw();
    });

    it('returns false for scalar class (rather than instance)', () => {
      expect(isScalarType(GraphQLScalarTypeImpl)).to.equal(false);
      expect(() => assertScalarType(GraphQLScalarTypeImpl)).to.throw();
    });

    it('returns false for wrapped scalar', () => {
      expect(isScalarType(new GraphQLListImpl(ScalarType))).to.equal(false);
      expect(() =>
        assertScalarType(new GraphQLListImpl(ScalarType)),
      ).to.throw();
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
  });

  describe('isObjectType', () => {
    it('returns true for object type', () => {
      expect(isObjectType(ObjectType)).to.equal(true);
      expect(() => assertObjectType(ObjectType)).to.not.throw();
    });

    it('returns false for wrapped object type', () => {
      expect(isObjectType(new GraphQLListImpl(ObjectType))).to.equal(false);
      expect(() =>
        assertObjectType(new GraphQLListImpl(ObjectType)),
      ).to.throw();
    });

    it('returns false for non-object type', () => {
      expect(isObjectType(InterfaceType)).to.equal(false);
      expect(() => assertObjectType(InterfaceType)).to.throw();
    });
  });

  describe('isInterfaceType', () => {
    it('returns true for interface type', () => {
      expect(isInterfaceType(InterfaceType)).to.equal(true);
      expect(() => assertInterfaceType(InterfaceType)).to.not.throw();
    });

    it('returns false for wrapped interface type', () => {
      expect(isInterfaceType(new GraphQLListImpl(InterfaceType))).to.equal(
        false,
      );
      expect(() =>
        assertInterfaceType(new GraphQLListImpl(InterfaceType)),
      ).to.throw();
    });

    it('returns false for non-interface type', () => {
      expect(isInterfaceType(ObjectType)).to.equal(false);
      expect(() => assertInterfaceType(ObjectType)).to.throw();
    });
  });

  describe('isUnionType', () => {
    it('returns true for union type', () => {
      expect(isUnionType(UnionType)).to.equal(true);
      expect(() => assertUnionType(UnionType)).to.not.throw();
    });

    it('returns false for wrapped union type', () => {
      expect(isUnionType(new GraphQLListImpl(UnionType))).to.equal(false);
      expect(() => assertUnionType(new GraphQLListImpl(UnionType))).to.throw();
    });

    it('returns false for non-union type', () => {
      expect(isUnionType(ObjectType)).to.equal(false);
      expect(() => assertUnionType(ObjectType)).to.throw();
    });
  });

  describe('isEnumType', () => {
    it('returns true for enum type', () => {
      expect(isEnumType(EnumType)).to.equal(true);
      expect(() => assertEnumType(EnumType)).to.not.throw();
    });

    it('returns false for wrapped enum type', () => {
      expect(isEnumType(new GraphQLListImpl(EnumType))).to.equal(false);
      expect(() => assertEnumType(new GraphQLListImpl(EnumType))).to.throw();
    });

    it('returns false for non-enum type', () => {
      expect(isEnumType(ScalarType)).to.equal(false);
      expect(() => assertEnumType(ScalarType)).to.throw();
    });
  });

  describe('isInputObjectType', () => {
    it('returns true for input object type', () => {
      expect(isInputObjectType(InputObjectType)).to.equal(true);
      expect(() => assertInputObjectType(InputObjectType)).to.not.throw();
    });

    it('returns false for wrapped input object type', () => {
      expect(isInputObjectType(new GraphQLListImpl(InputObjectType))).to.equal(
        false,
      );
      expect(() =>
        assertInputObjectType(new GraphQLListImpl(InputObjectType)),
      ).to.throw();
    });

    it('returns false for non-input-object type', () => {
      expect(isInputObjectType(ObjectType)).to.equal(false);
      expect(() => assertInputObjectType(ObjectType)).to.throw();
    });
  });

  describe('isListType', () => {
    it('returns true for a list wrapped type', () => {
      expect(isListType(new GraphQLListImpl(ObjectType))).to.equal(true);
      expect(() =>
        assertListType(new GraphQLListImpl(ObjectType)),
      ).to.not.throw();
    });

    it('returns false for an unwrapped type', () => {
      expect(isListType(ObjectType)).to.equal(false);
      expect(() => assertListType(ObjectType)).to.throw();
    });

    it('returns false for a non-list wrapped type', () => {
      expect(
        isListType(new GraphQLNonNullImpl(new GraphQLListImpl(ObjectType))),
      ).to.equal(false);
      expect(() =>
        assertListType(new GraphQLNonNullImpl(new GraphQLListImpl(ObjectType))),
      ).to.throw();
    });
  });

  describe('isNonNullType', () => {
    it('returns true for a non-null wrapped type', () => {
      expect(isNonNullType(new GraphQLNonNullImpl(ObjectType))).to.equal(true);
      expect(() =>
        assertNonNullType(new GraphQLNonNullImpl(ObjectType)),
      ).to.not.throw();
    });

    it('returns false for an unwrapped type', () => {
      expect(isNonNullType(ObjectType)).to.equal(false);
      expect(() => assertNonNullType(ObjectType)).to.throw();
    });

    it('returns false for a not non-null wrapped type', () => {
      expect(
        isNonNullType(new GraphQLListImpl(new GraphQLNonNullImpl(ObjectType))),
      ).to.equal(false);
      expect(() =>
        assertNonNullType(
          new GraphQLListImpl(new GraphQLNonNullImpl(ObjectType)),
        ),
      ).to.throw();
    });
  });

  describe('isInputType', () => {
    function expectInputType(type: unknown) {
      expect(isInputType(type)).to.equal(true);
      expect(() => assertInputType(type)).to.not.throw();
    }

    it('returns true for an input type', () => {
      expectInputType(GraphQLString);
      expectInputType(EnumType);
      expectInputType(InputObjectType);
    });

    it('returns true for a wrapped input type', () => {
      expectInputType(new GraphQLListImpl(GraphQLString));
      expectInputType(new GraphQLListImpl(EnumType));
      expectInputType(new GraphQLListImpl(InputObjectType));

      expectInputType(new GraphQLNonNullImpl(GraphQLString));
      expectInputType(new GraphQLNonNullImpl(EnumType));
      expectInputType(new GraphQLNonNullImpl(InputObjectType));
    });

    function expectNonInputType(type: unknown) {
      expect(isInputType(type)).to.equal(false);
      expect(() => assertInputType(type)).to.throw();
    }

    it('returns false for an output type', () => {
      expectNonInputType(ObjectType);
      expectNonInputType(InterfaceType);
      expectNonInputType(UnionType);
    });

    it('returns false for a wrapped output type', () => {
      expectNonInputType(new GraphQLListImpl(ObjectType));
      expectNonInputType(new GraphQLListImpl(InterfaceType));
      expectNonInputType(new GraphQLListImpl(UnionType));

      expectNonInputType(new GraphQLNonNullImpl(ObjectType));
      expectNonInputType(new GraphQLNonNullImpl(InterfaceType));
      expectNonInputType(new GraphQLNonNullImpl(UnionType));
    });
  });

  describe('isOutputType', () => {
    function expectOutputType(type: unknown) {
      expect(isOutputType(type)).to.equal(true);
      expect(() => assertOutputType(type)).to.not.throw();
    }

    it('returns true for an output type', () => {
      expectOutputType(GraphQLString);
      expectOutputType(ObjectType);
      expectOutputType(InterfaceType);
      expectOutputType(UnionType);
      expectOutputType(EnumType);
    });

    it('returns true for a wrapped output type', () => {
      expectOutputType(new GraphQLListImpl(GraphQLString));
      expectOutputType(new GraphQLListImpl(ObjectType));
      expectOutputType(new GraphQLListImpl(InterfaceType));
      expectOutputType(new GraphQLListImpl(UnionType));
      expectOutputType(new GraphQLListImpl(EnumType));

      expectOutputType(new GraphQLNonNullImpl(GraphQLString));
      expectOutputType(new GraphQLNonNullImpl(ObjectType));
      expectOutputType(new GraphQLNonNullImpl(InterfaceType));
      expectOutputType(new GraphQLNonNullImpl(UnionType));
      expectOutputType(new GraphQLNonNullImpl(EnumType));
    });

    function expectNonOutputType(type: unknown) {
      expect(isOutputType(type)).to.equal(false);
      expect(() => assertOutputType(type)).to.throw();
    }

    it('returns false for an input type', () => {
      expectNonOutputType(InputObjectType);
    });

    it('returns false for a wrapped input type', () => {
      expectNonOutputType(new GraphQLListImpl(InputObjectType));
      expectNonOutputType(new GraphQLNonNullImpl(InputObjectType));
    });
  });

  describe('isLeafType', () => {
    it('returns true for scalar and enum types', () => {
      expect(isLeafType(ScalarType)).to.equal(true);
      expect(() => assertLeafType(ScalarType)).to.not.throw();
      expect(isLeafType(EnumType)).to.equal(true);
      expect(() => assertLeafType(EnumType)).to.not.throw();
    });

    it('returns false for wrapped leaf type', () => {
      expect(isLeafType(new GraphQLListImpl(ScalarType))).to.equal(false);
      expect(() => assertLeafType(new GraphQLListImpl(ScalarType))).to.throw();
    });

    it('returns false for non-leaf type', () => {
      expect(isLeafType(ObjectType)).to.equal(false);
      expect(() => assertLeafType(ObjectType)).to.throw();
    });

    it('returns false for wrapped non-leaf type', () => {
      expect(isLeafType(new GraphQLListImpl(ObjectType))).to.equal(false);
      expect(() => assertLeafType(new GraphQLListImpl(ObjectType))).to.throw();
    });
  });

  describe('isCompositeType', () => {
    it('returns true for object, interface, and union types', () => {
      expect(isCompositeType(ObjectType)).to.equal(true);
      expect(() => assertCompositeType(ObjectType)).to.not.throw();
      expect(isCompositeType(InterfaceType)).to.equal(true);
      expect(() => assertCompositeType(InterfaceType)).to.not.throw();
      expect(isCompositeType(UnionType)).to.equal(true);
      expect(() => assertCompositeType(UnionType)).to.not.throw();
    });

    it('returns false for wrapped composite type', () => {
      expect(isCompositeType(new GraphQLListImpl(ObjectType))).to.equal(false);
      expect(() =>
        assertCompositeType(new GraphQLListImpl(ObjectType)),
      ).to.throw();
    });

    it('returns false for non-composite type', () => {
      expect(isCompositeType(InputObjectType)).to.equal(false);
      expect(() => assertCompositeType(InputObjectType)).to.throw();
    });

    it('returns false for wrapped non-composite type', () => {
      expect(isCompositeType(new GraphQLListImpl(InputObjectType))).to.equal(
        false,
      );
      expect(() =>
        assertCompositeType(new GraphQLListImpl(InputObjectType)),
      ).to.throw();
    });
  });

  describe('isAbstractType', () => {
    it('returns true for interface and union types', () => {
      expect(isAbstractType(InterfaceType)).to.equal(true);
      expect(() => assertAbstractType(InterfaceType)).to.not.throw();
      expect(isAbstractType(UnionType)).to.equal(true);
      expect(() => assertAbstractType(UnionType)).to.not.throw();
    });

    it('returns false for wrapped abstract type', () => {
      expect(isAbstractType(new GraphQLListImpl(InterfaceType))).to.equal(
        false,
      );
      expect(() =>
        assertAbstractType(new GraphQLListImpl(InterfaceType)),
      ).to.throw();
    });

    it('returns false for non-abstract type', () => {
      expect(isAbstractType(ObjectType)).to.equal(false);
      expect(() => assertAbstractType(ObjectType)).to.throw();
    });

    it('returns false for wrapped non-abstract type', () => {
      expect(isAbstractType(new GraphQLListImpl(ObjectType))).to.equal(false);
      expect(() =>
        assertAbstractType(new GraphQLListImpl(ObjectType)),
      ).to.throw();
    });
  });

  describe('isWrappingType', () => {
    it('returns true for list and non-null types', () => {
      expect(isWrappingType(new GraphQLListImpl(ObjectType))).to.equal(true);
      expect(() =>
        assertWrappingType(new GraphQLListImpl(ObjectType)),
      ).to.not.throw();
      expect(isWrappingType(new GraphQLNonNullImpl(ObjectType))).to.equal(true);
      expect(() =>
        assertWrappingType(new GraphQLNonNullImpl(ObjectType)),
      ).to.not.throw();
    });

    it('returns false for unwrapped types', () => {
      expect(isWrappingType(ObjectType)).to.equal(false);
      expect(() => assertWrappingType(ObjectType)).to.throw();
    });
  });

  describe('isNullableType', () => {
    it('returns true for unwrapped types', () => {
      expect(isNullableType(ObjectType)).to.equal(true);
      expect(() => assertNullableType(ObjectType)).to.not.throw();
    });

    it('returns true for list of non-null types', () => {
      expect(
        isNullableType(new GraphQLListImpl(new GraphQLNonNullImpl(ObjectType))),
      ).to.equal(true);
      expect(() =>
        assertNullableType(
          new GraphQLListImpl(new GraphQLNonNullImpl(ObjectType)),
        ),
      ).to.not.throw();
    });

    it('returns false for non-null types', () => {
      expect(isNullableType(new GraphQLNonNullImpl(ObjectType))).to.equal(
        false,
      );
      expect(() =>
        assertNullableType(new GraphQLNonNullImpl(ObjectType)),
      ).to.throw();
    });
  });

  describe('getNullableType', () => {
    it('returns undefined for no type', () => {
      expect(getNullableType(undefined)).to.equal(undefined);
      expect(getNullableType(null)).to.equal(undefined);
    });

    it('returns self for a nullable type', () => {
      expect(getNullableType(ObjectType)).to.equal(ObjectType);
      const listOfObj = new GraphQLListImpl(ObjectType);
      expect(getNullableType(listOfObj)).to.equal(listOfObj);
    });

    it('unwraps non-null type', () => {
      expect(getNullableType(new GraphQLNonNullImpl(ObjectType))).to.equal(
        ObjectType,
      );
    });
  });

  describe('isNamedType', () => {
    it('returns true for unwrapped types', () => {
      expect(isNamedType(ObjectType)).to.equal(true);
      expect(() => assertNamedType(ObjectType)).to.not.throw();
    });

    it('returns false for list and non-null types', () => {
      expect(isNamedType(new GraphQLListImpl(ObjectType))).to.equal(false);
      expect(() => assertNamedType(new GraphQLListImpl(ObjectType))).to.throw();
      expect(isNamedType(new GraphQLNonNullImpl(ObjectType))).to.equal(false);
      expect(() =>
        assertNamedType(new GraphQLNonNullImpl(ObjectType)),
      ).to.throw();
    });
  });

  describe('getNamedType', () => {
    it('returns undefined for no type', () => {
      expect(getNamedType(undefined)).to.equal(undefined);
      expect(getNamedType(null)).to.equal(undefined);
    });

    it('returns self for a unwrapped type', () => {
      expect(getNamedType(ObjectType)).to.equal(ObjectType);
    });

    it('unwraps wrapper types', () => {
      expect(getNamedType(new GraphQLNonNullImpl(ObjectType))).to.equal(
        ObjectType,
      );
      expect(getNamedType(new GraphQLListImpl(ObjectType))).to.equal(
        ObjectType,
      );
    });

    it('unwraps deeply wrapper types', () => {
      expect(
        getNamedType(
          new GraphQLNonNullImpl(
            new GraphQLListImpl(new GraphQLNonNullImpl(ObjectType)),
          ),
        ),
      ).to.equal(ObjectType);
    });
  });

  describe('isRequiredArgument', () => {
    function buildArg(config: {
      type: GraphQLInputType;
      defaultValue?: unknown;
    }): GraphQLArgument {
      return {
        name: 'someArg',
        type: config.type,
        description: undefined,
        defaultValue: config.defaultValue,
        deprecationReason: null,
        extensions: Object.create(null),
        astNode: undefined,
      };
    }

    it('returns true for required arguments', () => {
      const requiredArg = buildArg({
        type: new GraphQLNonNullImpl(GraphQLString),
      });
      expect(isRequiredArgument(requiredArg)).to.equal(true);
    });

    it('returns false for optional arguments', () => {
      const optArg1 = buildArg({
        type: GraphQLString,
      });
      expect(isRequiredArgument(optArg1)).to.equal(false);

      const optArg2 = buildArg({
        type: GraphQLString,
        defaultValue: null,
      });
      expect(isRequiredArgument(optArg2)).to.equal(false);

      const optArg3 = buildArg({
        type: new GraphQLListImpl(new GraphQLNonNullImpl(GraphQLString)),
      });
      expect(isRequiredArgument(optArg3)).to.equal(false);

      const optArg4 = buildArg({
        type: new GraphQLNonNullImpl(GraphQLString),
        defaultValue: 'default',
      });
      expect(isRequiredArgument(optArg4)).to.equal(false);
    });
  });

  describe('isRequiredInputField', () => {
    function buildInputField(config: {
      type: GraphQLInputType;
      defaultValue?: unknown;
    }): GraphQLInputField {
      return {
        name: 'someInputField',
        type: config.type,
        description: undefined,
        defaultValue: config.defaultValue,
        deprecationReason: null,
        extensions: Object.create(null),
        astNode: undefined,
      };
    }

    it('returns true for required input field', () => {
      const requiredField = buildInputField({
        type: new GraphQLNonNullImpl(GraphQLString),
      });
      expect(isRequiredInputField(requiredField)).to.equal(true);
    });

    it('returns false for optional input field', () => {
      const optField1 = buildInputField({
        type: GraphQLString,
      });
      expect(isRequiredInputField(optField1)).to.equal(false);

      const optField2 = buildInputField({
        type: GraphQLString,
        defaultValue: null,
      });
      expect(isRequiredInputField(optField2)).to.equal(false);

      const optField3 = buildInputField({
        type: new GraphQLListImpl(new GraphQLNonNullImpl(GraphQLString)),
      });
      expect(isRequiredInputField(optField3)).to.equal(false);

      const optField4 = buildInputField({
        type: new GraphQLNonNullImpl(GraphQLString),
        defaultValue: 'default',
      });
      expect(isRequiredInputField(optField4)).to.equal(false);
    });
  });
});

describe('Directive predicates', () => {
  describe('isDirective', () => {
    it('returns true for spec defined directive', () => {
      expect(isDirective(GraphQLSkipDirective)).to.equal(true);
      expect(() => assertDirective(GraphQLSkipDirective)).to.not.throw();
    });

    it('returns true for custom directive', () => {
      expect(isDirective(Directive)).to.equal(true);
      expect(() => assertDirective(Directive)).to.not.throw();
    });

    it('returns false for directive class (rather than instance)', () => {
      expect(isDirective(GraphQLDirectiveImpl)).to.equal(false);
      expect(() => assertDirective(GraphQLDirectiveImpl)).to.throw();
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
  });
});
