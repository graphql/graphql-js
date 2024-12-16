import { expect } from 'chai';
import { describe, it } from 'mocha';

import { DirectiveLocation } from '../../language/directiveLocation.js';

import type {
  GraphQLArgument,
  GraphQLDefaultInput,
  GraphQLInputField,
  GraphQLInputType,
} from '../definition.js';
import {
  assertAbstractType,
  assertArgument,
  assertCompositeType,
  assertEnumType,
  assertEnumValue,
  assertField,
  assertInputField,
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
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  isAbstractType,
  isArgument,
  isCompositeType,
  isEnumType,
  isEnumValue,
  isField,
  isInputField,
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
} from '../definition.js';
import {
  assertDirective,
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  isDirective,
  isSpecifiedDirective,
} from '../directives.js';
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
  isSpecifiedScalarType,
} from '../scalars.js';
import { assertSchema, GraphQLSchema, isSchema } from '../schema.js';

const ObjectType = new GraphQLObjectType({
  name: 'Object',
  fields: { f: { type: GraphQLString, args: { a: { type: GraphQLString } } } },
});
const InterfaceType = new GraphQLInterfaceType({
  name: 'Interface',
  fields: {},
});
const UnionType = new GraphQLUnionType({ name: 'Union', types: [ObjectType] });
const EnumType = new GraphQLEnumType({ name: 'Enum', values: { foo: {} } });
const InputObjectType = new GraphQLInputObjectType({
  name: 'InputObject',
  fields: { f: { type: GraphQLString } },
});
const ScalarType = new GraphQLScalarType({ name: 'Scalar' });
const Directive = new GraphQLDirective({
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
      expect(isType(new GraphQLNonNull(GraphQLString))).to.equal(true);
      expect(() =>
        assertType(new GraphQLNonNull(GraphQLString)),
      ).to.not.throw();
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
      expect(() => assertScalarType(GraphQLString)).to.not.throw();
    });

    it('returns true for custom scalar', () => {
      expect(isScalarType(ScalarType)).to.equal(true);
      expect(() => assertScalarType(ScalarType)).to.not.throw();
    });

    it('returns false for scalar class (rather than instance)', () => {
      expect(isScalarType(GraphQLScalarType)).to.equal(false);
      expect(() => assertScalarType(GraphQLScalarType)).to.throw();
    });

    it('returns false for wrapped scalar', () => {
      expect(isScalarType(new GraphQLList(ScalarType))).to.equal(false);
      expect(() => assertScalarType(new GraphQLList(ScalarType))).to.throw();
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
      expect(isObjectType(new GraphQLList(ObjectType))).to.equal(false);
      expect(() => assertObjectType(new GraphQLList(ObjectType))).to.throw();
    });

    it('returns false for non-object type', () => {
      expect(isObjectType(InterfaceType)).to.equal(false);
      expect(() => assertObjectType(InterfaceType)).to.throw();
    });
  });

  describe('isField', () => {
    it('returns true for fields', () => {
      const f = ObjectType.getFields().f;
      expect(isField(f)).to.equal(true);
      expect(() => assertField(f)).to.not.throw();
    });

    it('returns false for non-field', () => {
      const inputField = InputObjectType.getFields().f;
      expect(isField(inputField)).to.equal(false);
      expect(() => assertField(inputField)).to.throw();
    });
  });

  describe('isArgument', () => {
    it('returns true for arguments', () => {
      const a = ObjectType.getFields().f.args[0];
      expect(isArgument(a)).to.equal(true);
      expect(() => assertArgument(a)).to.not.throw();
    });

    it('returns false for non-arguments', () => {
      const f = ObjectType.getFields().f;
      expect(isArgument(f)).to.equal(false);
      expect(() => assertArgument(f)).to.throw();
    });
  });

  describe('isInterfaceType', () => {
    it('returns true for interface type', () => {
      expect(isInterfaceType(InterfaceType)).to.equal(true);
      expect(() => assertInterfaceType(InterfaceType)).to.not.throw();
    });

    it('returns false for wrapped interface type', () => {
      expect(isInterfaceType(new GraphQLList(InterfaceType))).to.equal(false);
      expect(() =>
        assertInterfaceType(new GraphQLList(InterfaceType)),
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
      expect(isUnionType(new GraphQLList(UnionType))).to.equal(false);
      expect(() => assertUnionType(new GraphQLList(UnionType))).to.throw();
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
      expect(isEnumType(new GraphQLList(EnumType))).to.equal(false);
      expect(() => assertEnumType(new GraphQLList(EnumType))).to.throw();
    });

    it('returns false for non-enum type', () => {
      expect(isEnumType(ScalarType)).to.equal(false);
      expect(() => assertEnumType(ScalarType)).to.throw();
    });
  });

  describe('isEnumValue', () => {
    it('returns true for enum value', () => {
      const value = EnumType.getValue('foo');
      expect(isEnumValue(value)).to.equal(true);
      expect(() => assertEnumValue(value)).to.not.throw();
    });

    it('returns false for non-enum type', () => {
      expect(isEnumValue(EnumType)).to.equal(false);
      expect(() => assertEnumValue(EnumType)).to.throw();
    });
  });

  describe('isInputObjectType', () => {
    it('returns true for input object type', () => {
      expect(isInputObjectType(InputObjectType)).to.equal(true);
      expect(() => assertInputObjectType(InputObjectType)).to.not.throw();
    });

    it('returns false for wrapped input object type', () => {
      expect(isInputObjectType(new GraphQLList(InputObjectType))).to.equal(
        false,
      );
      expect(() =>
        assertInputObjectType(new GraphQLList(InputObjectType)),
      ).to.throw();
    });

    it('returns false for non-input-object type', () => {
      expect(isInputObjectType(ObjectType)).to.equal(false);
      expect(() => assertInputObjectType(ObjectType)).to.throw();
    });
  });

  describe('isInputField', () => {
    it('returns true for input fields', () => {
      const f = InputObjectType.getFields().f;
      expect(isInputField(f)).to.equal(true);
      expect(() => assertInputField(f)).to.not.throw();
    });

    it('returns false for non-input fields', () => {
      const f = ObjectType.getFields().f;
      expect(isInputField(f)).to.equal(false);
      expect(() => assertInputField(f)).to.throw();
    });
  });

  describe('isListType', () => {
    it('returns true for a list wrapped type', () => {
      expect(isListType(new GraphQLList(ObjectType))).to.equal(true);
      expect(() => assertListType(new GraphQLList(ObjectType))).to.not.throw();
    });

    it('returns false for an unwrapped type', () => {
      expect(isListType(ObjectType)).to.equal(false);
      expect(() => assertListType(ObjectType)).to.throw();
    });

    it('returns false for a non-list wrapped type', () => {
      expect(
        isListType(new GraphQLNonNull(new GraphQLList(ObjectType))),
      ).to.equal(false);
      expect(() =>
        assertListType(new GraphQLNonNull(new GraphQLList(ObjectType))),
      ).to.throw();
    });
  });

  describe('isNonNullType', () => {
    it('returns true for a non-null wrapped type', () => {
      expect(isNonNullType(new GraphQLNonNull(ObjectType))).to.equal(true);
      expect(() =>
        assertNonNullType(new GraphQLNonNull(ObjectType)),
      ).to.not.throw();
    });

    it('returns false for an unwrapped type', () => {
      expect(isNonNullType(ObjectType)).to.equal(false);
      expect(() => assertNonNullType(ObjectType)).to.throw();
    });

    it('returns false for a not non-null wrapped type', () => {
      expect(
        isNonNullType(new GraphQLList(new GraphQLNonNull(ObjectType))),
      ).to.equal(false);
      expect(() =>
        assertNonNullType(new GraphQLList(new GraphQLNonNull(ObjectType))),
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
      expectInputType(new GraphQLList(GraphQLString));
      expectInputType(new GraphQLList(EnumType));
      expectInputType(new GraphQLList(InputObjectType));

      expectInputType(new GraphQLNonNull(GraphQLString));
      expectInputType(new GraphQLNonNull(EnumType));
      expectInputType(new GraphQLNonNull(InputObjectType));
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
      expectNonInputType(new GraphQLList(ObjectType));
      expectNonInputType(new GraphQLList(InterfaceType));
      expectNonInputType(new GraphQLList(UnionType));

      expectNonInputType(new GraphQLNonNull(ObjectType));
      expectNonInputType(new GraphQLNonNull(InterfaceType));
      expectNonInputType(new GraphQLNonNull(UnionType));
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
      expectOutputType(new GraphQLList(GraphQLString));
      expectOutputType(new GraphQLList(ObjectType));
      expectOutputType(new GraphQLList(InterfaceType));
      expectOutputType(new GraphQLList(UnionType));
      expectOutputType(new GraphQLList(EnumType));

      expectOutputType(new GraphQLNonNull(GraphQLString));
      expectOutputType(new GraphQLNonNull(ObjectType));
      expectOutputType(new GraphQLNonNull(InterfaceType));
      expectOutputType(new GraphQLNonNull(UnionType));
      expectOutputType(new GraphQLNonNull(EnumType));
    });

    function expectNonOutputType(type: unknown) {
      expect(isOutputType(type)).to.equal(false);
      expect(() => assertOutputType(type)).to.throw();
    }

    it('returns false for an input type', () => {
      expectNonOutputType(InputObjectType);
    });

    it('returns false for a wrapped input type', () => {
      expectNonOutputType(new GraphQLList(InputObjectType));
      expectNonOutputType(new GraphQLNonNull(InputObjectType));
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
      expect(isLeafType(new GraphQLList(ScalarType))).to.equal(false);
      expect(() => assertLeafType(new GraphQLList(ScalarType))).to.throw();
    });

    it('returns false for non-leaf type', () => {
      expect(isLeafType(ObjectType)).to.equal(false);
      expect(() => assertLeafType(ObjectType)).to.throw();
    });

    it('returns false for wrapped non-leaf type', () => {
      expect(isLeafType(new GraphQLList(ObjectType))).to.equal(false);
      expect(() => assertLeafType(new GraphQLList(ObjectType))).to.throw();
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
      expect(isCompositeType(new GraphQLList(ObjectType))).to.equal(false);
      expect(() => assertCompositeType(new GraphQLList(ObjectType))).to.throw();
    });

    it('returns false for non-composite type', () => {
      expect(isCompositeType(InputObjectType)).to.equal(false);
      expect(() => assertCompositeType(InputObjectType)).to.throw();
    });

    it('returns false for wrapped non-composite type', () => {
      expect(isCompositeType(new GraphQLList(InputObjectType))).to.equal(false);
      expect(() =>
        assertCompositeType(new GraphQLList(InputObjectType)),
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
      expect(isAbstractType(new GraphQLList(InterfaceType))).to.equal(false);
      expect(() =>
        assertAbstractType(new GraphQLList(InterfaceType)),
      ).to.throw();
    });

    it('returns false for non-abstract type', () => {
      expect(isAbstractType(ObjectType)).to.equal(false);
      expect(() => assertAbstractType(ObjectType)).to.throw();
    });

    it('returns false for wrapped non-abstract type', () => {
      expect(isAbstractType(new GraphQLList(ObjectType))).to.equal(false);
      expect(() => assertAbstractType(new GraphQLList(ObjectType))).to.throw();
    });
  });

  describe('isWrappingType', () => {
    it('returns true for list and non-null types', () => {
      expect(isWrappingType(new GraphQLList(ObjectType))).to.equal(true);
      expect(() =>
        assertWrappingType(new GraphQLList(ObjectType)),
      ).to.not.throw();
      expect(isWrappingType(new GraphQLNonNull(ObjectType))).to.equal(true);
      expect(() =>
        assertWrappingType(new GraphQLNonNull(ObjectType)),
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
        isNullableType(new GraphQLList(new GraphQLNonNull(ObjectType))),
      ).to.equal(true);
      expect(() =>
        assertNullableType(new GraphQLList(new GraphQLNonNull(ObjectType))),
      ).to.not.throw();
    });

    it('returns false for non-null types', () => {
      expect(isNullableType(new GraphQLNonNull(ObjectType))).to.equal(false);
      expect(() =>
        assertNullableType(new GraphQLNonNull(ObjectType)),
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
      const listOfObj = new GraphQLList(ObjectType);
      expect(getNullableType(listOfObj)).to.equal(listOfObj);
    });

    it('unwraps non-null type', () => {
      expect(getNullableType(new GraphQLNonNull(ObjectType))).to.equal(
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
      expect(isNamedType(new GraphQLList(ObjectType))).to.equal(false);
      expect(() => assertNamedType(new GraphQLList(ObjectType))).to.throw();
      expect(isNamedType(new GraphQLNonNull(ObjectType))).to.equal(false);
      expect(() => assertNamedType(new GraphQLNonNull(ObjectType))).to.throw();
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
      expect(getNamedType(new GraphQLNonNull(ObjectType))).to.equal(ObjectType);
      expect(getNamedType(new GraphQLList(ObjectType))).to.equal(ObjectType);
    });

    it('unwraps deeply wrapper types', () => {
      expect(
        getNamedType(
          new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ObjectType))),
        ),
      ).to.equal(ObjectType);
    });
  });

  describe('isRequiredArgument', () => {
    function buildArg(config: {
      type: GraphQLInputType;
      default?: GraphQLDefaultInput;
    }): GraphQLArgument {
      const objectType = new GraphQLObjectType({
        name: 'SomeType',
        fields: {
          someField: { type: GraphQLString, args: { someArg: config } },
        },
      });
      return objectType.getFields().someField.args[0];
    }

    it('returns true for required arguments', () => {
      const requiredArg = buildArg({
        type: new GraphQLNonNull(GraphQLString),
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
        default: { value: null },
      });
      expect(isRequiredArgument(optArg2)).to.equal(false);

      const optArg3 = buildArg({
        type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
      });
      expect(isRequiredArgument(optArg3)).to.equal(false);

      const optArg4 = buildArg({
        type: new GraphQLNonNull(GraphQLString),
        default: { value: 'default' },
      });
      expect(isRequiredArgument(optArg4)).to.equal(false);
    });
  });

  describe('isRequiredInputField', () => {
    function buildInputField(config: {
      type: GraphQLInputType;
      default?: GraphQLDefaultInput;
    }): GraphQLInputField {
      const inputObjectType = new GraphQLInputObjectType({
        name: 'SomeType',
        fields: {
          someInputField: config,
        },
      });
      return inputObjectType.getFields().someInputField;
    }

    it('returns true for required input field', () => {
      const requiredField = buildInputField({
        type: new GraphQLNonNull(GraphQLString),
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
        default: { value: null },
      });
      expect(isRequiredInputField(optField2)).to.equal(false);

      const optField3 = buildInputField({
        type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
      });
      expect(isRequiredInputField(optField3)).to.equal(false);

      const optField4 = buildInputField({
        type: new GraphQLNonNull(GraphQLString),
        default: { value: 'default' },
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
  });
});

describe('Schema predicates', () => {
  const schema = new GraphQLSchema({});

  describe('isSchema/assertSchema', () => {
    it('returns true for schema', () => {
      expect(isSchema(schema)).to.equal(true);
      expect(() => assertSchema(schema)).to.not.throw();
    });

    it('returns false for schema class (rather than instance)', () => {
      expect(isSchema(GraphQLSchema)).to.equal(false);
      expect(() => assertSchema(GraphQLSchema)).to.throw();
    });

    it('returns false for non-schema', () => {
      expect(isSchema(EnumType)).to.equal(false);
      expect(() => assertSchema(EnumType)).to.throw();
      expect(isSchema(ScalarType)).to.equal(false);
      expect(() => assertSchema(ScalarType)).to.throw();
    });

    it('returns false for random garbage', () => {
      expect(isSchema({ what: 'is this' })).to.equal(false);
      expect(() => assertSchema({ what: 'is this' })).to.throw();
    });
  });
});
