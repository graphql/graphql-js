import { expect } from 'chai';
import { describe, it } from 'mocha';

import { identityFunc } from '../../jsutils/identityFunc.js';
import { inspect } from '../../jsutils/inspect.js';

import { Kind } from '../../language/kinds.js';
import { parseConstValue } from '../../language/parser.js';

import type {
  GraphQLEnumTypeConfig,
  GraphQLInputObjectTypeConfig,
  GraphQLInterfaceTypeConfig,
  GraphQLNullableType,
  GraphQLObjectTypeConfig,
  GraphQLScalarTypeConfig,
  GraphQLType,
  GraphQLUnionTypeConfig,
} from '../definition.js';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
} from '../definition.js';
import { GraphQLString } from '../scalars.js';

const ScalarType = new GraphQLScalarType({ name: 'Scalar' });
const ObjectType = new GraphQLObjectType({
  name: 'Object',
  fields: {
    someField: {
      type: GraphQLString,
      args: { someArg: { type: GraphQLString } },
    },
  },
});
const InterfaceType = new GraphQLInterfaceType({
  name: 'Interface',
  fields: {},
});
const UnionType = new GraphQLUnionType({ name: 'Union', types: [ObjectType] });
const EnumType = new GraphQLEnumType({ name: 'Enum', values: { foo: {} } });
const InputObjectType = new GraphQLInputObjectType({
  name: 'InputObject',
  fields: { someInputField: { type: GraphQLString } },
});

const ListOfScalarsType = new GraphQLList(ScalarType);
const NonNullScalarType = new GraphQLNonNull(ScalarType);
const ListOfNonNullScalarsType = new GraphQLList(NonNullScalarType);
const NonNullListOfScalars = new GraphQLNonNull(ListOfScalarsType);

/* c8 ignore next */
const passThroughFunc = (arg: any) => arg;
const dummyAny = {} as any;

describe('Type System: Scalars', () => {
  it('can be converted from a minimal configuration object', () => {
    const someScalar = new GraphQLScalarType({ name: 'SomeScalar' });
    expect(someScalar.toConfig()).to.deep.equal({
      name: 'SomeScalar',
      description: undefined,
      specifiedByURL: undefined,
      serialize: someScalar.serialize,
      parseValue: someScalar.parseValue,
      parseLiteral: someScalar.parseLiteral,
      coerceOutputValue: someScalar.coerceOutputValue,
      coerceInputValue: someScalar.coerceInputValue,
      coerceInputLiteral: undefined,
      valueToLiteral: undefined,
      extensions: {},
      astNode: undefined,
      extensionASTNodes: [],
    });
  });

  it('can be converted to a configuration object', () => {
    const someScalarConfig: GraphQLScalarTypeConfig<unknown, unknown> = {
      name: 'SomeScalar',
      description: 'SomeScalar description.',
      specifiedByURL: 'https://example.com/foo_spec',
      serialize: passThroughFunc,
      parseValue: passThroughFunc,
      parseLiteral: passThroughFunc,
      coerceOutputValue: passThroughFunc,
      coerceInputValue: passThroughFunc,
      coerceInputLiteral: passThroughFunc,
      valueToLiteral: passThroughFunc,
      extensions: { someExtension: 'extension' },
      astNode: dummyAny,
      extensionASTNodes: [dummyAny],
    };
    const someScalar = new GraphQLScalarType(someScalarConfig);
    expect(someScalar.toConfig()).to.deep.equal(someScalarConfig);
  });

  it('supports symbol extensions', () => {
    const test = Symbol.for('test');
    const someScalarConfig: GraphQLScalarTypeConfig<unknown, unknown> = {
      name: 'SomeScalar',
      description: 'SomeScalar description.',
      specifiedByURL: 'https://example.com/foo_spec',
      serialize: passThroughFunc,
      parseValue: passThroughFunc,
      parseLiteral: passThroughFunc,
      coerceOutputValue: passThroughFunc,
      coerceInputValue: passThroughFunc,
      coerceInputLiteral: passThroughFunc,
      valueToLiteral: passThroughFunc,
      extensions: { [test]: 'extension' },
      astNode: dummyAny,
      extensionASTNodes: [dummyAny],
    };
    const someScalar = new GraphQLScalarType(someScalarConfig);
    expect(someScalar.toConfig()).to.deep.equal(someScalarConfig);
  });

  it('provides default methods if omitted', () => {
    const scalar = new GraphQLScalarType({ name: 'Foo' });

    expect(scalar.serialize).to.equal(identityFunc);
    expect(scalar.parseValue).to.equal(identityFunc);
    expect(scalar.coerceOutputValue).to.equal(identityFunc);
    expect(scalar.coerceInputValue).to.equal(identityFunc);
    expect(scalar.parseLiteral).to.be.a('function');
    /* default will be provided in v18 when parseLiteral is removed */
    // expect(scalar.coerceInputLiteral).to.be.a('function');
  });

  it('use parseValue for parsing literals if parseLiteral omitted', () => {
    const scalar = new GraphQLScalarType({
      name: 'Foo',
      parseValue(value) {
        return 'parseValue: ' + inspect(value);
      },
    });

    expect(scalar.parseLiteral(parseConstValue('null'), undefined)).to.equal(
      'parseValue: null',
    );
    expect(
      scalar.parseLiteral(parseConstValue('{ foo: "bar" }'), undefined),
    ).to.equal('parseValue: { foo: "bar" }');
  });

  it('rejects a Scalar type defining parseLiteral but not parseValue', () => {
    expect(
      () =>
        new GraphQLScalarType({
          name: 'SomeScalar',
          parseLiteral: passThroughFunc,
        }),
    ).to.throw(
      'SomeScalar must provide both "parseValue" and "parseLiteral" functions.',
    );
  });

  it('rejects a Scalar type defining coerceInputLiteral but not coerceInputValue', () => {
    expect(
      () =>
        new GraphQLScalarType({
          name: 'SomeScalar',
          coerceInputLiteral: passThroughFunc,
        }),
    ).to.throw(
      'SomeScalar must provide both "coerceInputValue" and "coerceInputLiteral" functions.',
    );
  });
});

describe('Type System: Objects', () => {
  it('can be converted from a minimal configuration object', () => {
    const someObject = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {},
    });
    expect(someObject.toConfig()).to.deep.equal({
      name: 'SomeObject',
      description: undefined,
      interfaces: [],
      fields: {},
      isTypeOf: undefined,
      extensions: {},
      astNode: undefined,
      extensionASTNodes: [],
    });
  });

  it('can be converted to a configuration object', () => {
    const someObjectConfig: GraphQLObjectTypeConfig<unknown, unknown> = {
      name: 'SomeObject',
      description: 'SomeObject description.',
      interfaces: [InterfaceType],
      fields: {
        f: {
          description: 'Field description.',
          type: ScalarType,
          args: {
            input: {
              description: 'Argument description.',
              type: ScalarType,
              defaultValue: undefined,
              default: { value: 'DefaultValue' },
              deprecationReason: 'Argument deprecation reason.',
              extensions: { someExtension: 'extension' },
              astNode: dummyAny,
            },
          },
          resolve: passThroughFunc,
          subscribe: passThroughFunc,
          deprecationReason: 'Field deprecation reason.',
          extensions: { someExtension: 'extension' },
          astNode: dummyAny,
        },
      },
      isTypeOf: passThroughFunc,
      extensions: { someExtension: 'extension' },
      astNode: dummyAny,
      extensionASTNodes: [dummyAny],
    };
    const someObject = new GraphQLObjectType(someObjectConfig);
    expect(someObject.toConfig()).to.deep.equal(someObjectConfig);
  });

  it('does not mutate passed field definitions', () => {
    const outputFields = {
      field1: { type: ScalarType },
      field2: {
        type: ScalarType,
        args: {
          id: { type: ScalarType },
        },
      },
    };
    const testObject1 = new GraphQLObjectType({
      name: 'Test1',
      fields: outputFields,
    });
    const testObject2 = new GraphQLObjectType({
      name: 'Test2',
      fields: outputFields,
    });

    const testObject1Fields = testObject1.getFields();
    const testObject2Fields = testObject2.getFields();

    expect(testObject1Fields.field1.toConfig()).to.deep.equal(
      testObject2Fields.field1.toConfig(),
    );
    expect(testObject1Fields.field2.toConfig()).to.deep.equal(
      testObject2Fields.field2.toConfig(),
    );
    expect(outputFields).to.deep.equal({
      field1: {
        type: ScalarType,
      },
      field2: {
        type: ScalarType,
        args: {
          id: { type: ScalarType },
        },
      },
    });

    const inputFields = {
      field1: { type: ScalarType },
      field2: { type: ScalarType },
    };
    const testInputObject1 = new GraphQLInputObjectType({
      name: 'Test1',
      fields: inputFields,
    });
    const testInputObject2 = new GraphQLInputObjectType({
      name: 'Test2',
      fields: inputFields,
    });

    const testInputObject1Fields = testInputObject1.getFields();
    const testInputObject2Fields = testInputObject2.getFields();

    expect(testInputObject1Fields.field1.toConfig()).to.deep.equal(
      testInputObject2Fields.field1.toConfig(),
    );
    expect(testInputObject1Fields.field2.toConfig()).to.deep.equal(
      testInputObject2Fields.field2.toConfig(),
    );
    expect(inputFields).to.deep.equal({
      field1: { type: ScalarType },
      field2: { type: ScalarType },
    });
  });

  it('defines an object type with deprecated field', () => {
    const TypeWithDeprecatedField = new GraphQLObjectType({
      name: 'foo',
      fields: {
        bar: {
          type: ScalarType,
          deprecationReason: 'A terrible reason',
        },
        baz: {
          type: ScalarType,
          deprecationReason: '',
        },
      },
    });

    expect(TypeWithDeprecatedField.getFields().bar).to.include({
      name: 'bar',
      deprecationReason: 'A terrible reason',
    });

    expect(TypeWithDeprecatedField.getFields().baz).to.include({
      name: 'baz',
      deprecationReason: '',
    });
  });

  it('accepts an Object type with a field function', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      fields: () => ({
        f: { type: ScalarType },
      }),
    });
    expect(objType.getFields().f).to.deep.include({
      parentType: objType,
      name: 'f',
      description: undefined,
      type: ScalarType,
      args: [],
      resolve: undefined,
      subscribe: undefined,
      deprecationReason: undefined,
      extensions: {},
      astNode: undefined,
    });
  });

  it('accepts an Object type with field args', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {
        f: {
          type: ScalarType,
          args: {
            arg: { type: ScalarType },
          },
        },
      },
    });

    const f = objType.getFields().f;

    expect(f).to.deep.include({
      parentType: objType,
      name: 'f',
      description: undefined,
      type: ScalarType,
      resolve: undefined,
      subscribe: undefined,
      deprecationReason: undefined,
      extensions: {},
      astNode: undefined,
    });

    expect(f.args).to.have.lengthOf(1);

    expect(f.args[0]).to.deep.include({
      parent: f,
      name: 'arg',
      description: undefined,
      type: ScalarType,
      defaultValue: undefined,
      default: undefined,
      deprecationReason: undefined,
      extensions: {},
      astNode: undefined,
    });
  });

  it('accepts an Object type with array interfaces', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {},
      interfaces: [InterfaceType],
    });
    expect(objType.getInterfaces()).to.deep.equal([InterfaceType]);
  });

  it('accepts an Object type with interfaces as a function returning an array', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {},
      interfaces: () => [InterfaceType],
    });
    expect(objType.getInterfaces()).to.deep.equal([InterfaceType]);
  });

  it('accepts a lambda as an Object field resolver', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {
        f: {
          type: ScalarType,
          resolve: passThroughFunc,
        },
      },
    });
    expect(() => objType.getFields()).to.not.throw();
  });

  it('rejects an Object type with invalid name', () => {
    expect(
      () => new GraphQLObjectType({ name: 'bad-name', fields: {} }),
    ).to.throw('Names must only contain [_a-zA-Z0-9] but "bad-name" does not.');
  });

  it('rejects an Object type with incorrectly named fields', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {
        'bad-name': { type: ScalarType },
      },
    });
    expect(() => objType.getFields()).to.throw(
      'Names must only contain [_a-zA-Z0-9] but "bad-name" does not.',
    );
  });

  it('rejects an Object type with a field function that returns incorrect type', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      // @ts-expect-error (Wrong type of return)
      fields() {
        return [{ field: ScalarType }];
      },
    });
    expect(() => objType.getFields()).to.throw();
  });

  it('rejects an Object type with incorrectly named field args', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {
        badField: {
          type: ScalarType,
          args: {
            'bad-name': { type: ScalarType },
          },
        },
      },
    });
    expect(() => objType.getFields()).to.throw(
      'Names must only contain [_a-zA-Z0-9] but "bad-name" does not.',
    );
  });
});

describe('Type System: Interfaces', () => {
  it('can be converted from a minimal configuration object', () => {
    const someInterface = new GraphQLInterfaceType({
      name: 'SomeInterface',
      fields: {},
    });
    expect(someInterface.toConfig()).to.deep.equal({
      name: 'SomeInterface',
      description: undefined,
      interfaces: [],
      fields: {},
      resolveType: undefined,
      extensions: {},
      astNode: undefined,
      extensionASTNodes: [],
    });
  });

  it('can be converted to a configuration object', () => {
    const someInterfaceConfig: GraphQLInterfaceTypeConfig<unknown, unknown> = {
      name: 'SomeInterface',
      description: 'SomeInterface description.',
      interfaces: [InterfaceType],
      fields: {
        f: {
          description: 'Field description.',
          type: ScalarType,
          args: {
            input: {
              description: 'Argument description.',
              type: ScalarType,
              defaultValue: undefined,
              default: { literal: dummyAny },
              deprecationReason: 'Argument deprecation reason.',
              extensions: { someExtension: 'extension' },
              astNode: dummyAny,
            },
          },
          resolve: passThroughFunc,
          subscribe: passThroughFunc,
          deprecationReason: 'Field deprecation reason.',
          extensions: { someExtension: 'extension' },
          astNode: dummyAny,
        },
      },
      resolveType: passThroughFunc,
      extensions: {},
      astNode: {} as any,
      extensionASTNodes: [],
    };
    const someInterface = new GraphQLInterfaceType(someInterfaceConfig);
    expect(someInterface.toConfig()).to.deep.equal(someInterfaceConfig);
  });

  it('accepts an Interface type defining a field', () => {
    expect(
      () =>
        new GraphQLInterfaceType({
          name: 'AnotherInterface',
          fields: { f: { type: ScalarType } },
        }),
    ).to.not.throw();
  });

  it('accepts an Interface type with a field function', () => {
    const interfaceType = new GraphQLInterfaceType({
      name: 'SomeInterface',
      fields: () => ({
        f: { type: ScalarType },
      }),
    });
    expect(interfaceType.getFields().f).to.deep.include({
      name: 'f',
      description: undefined,
      type: ScalarType,
      args: [],
      resolve: undefined,
      subscribe: undefined,
      deprecationReason: undefined,
      extensions: {},
      astNode: undefined,
    });
  });

  it('accepts an Interface type with an array of interfaces', () => {
    const implementing = new GraphQLInterfaceType({
      name: 'AnotherInterface',
      fields: {},
      interfaces: [InterfaceType],
    });
    expect(implementing.getInterfaces()).to.deep.equal([InterfaceType]);
  });

  it('accepts an Interface type with interfaces as a function returning an array', () => {
    const implementing = new GraphQLInterfaceType({
      name: 'AnotherInterface',
      fields: {},
      interfaces: () => [InterfaceType],
    });
    expect(implementing.getInterfaces()).to.deep.equal([InterfaceType]);
  });

  it('rejects an Interface type with invalid name', () => {
    expect(
      () => new GraphQLInterfaceType({ name: 'bad-name', fields: {} }),
    ).to.throw('Names must only contain [_a-zA-Z0-9] but "bad-name" does not.');
  });
});

describe('Type System: Unions', () => {
  it('can be converted from a minimal configuration object', () => {
    const someUnion = new GraphQLUnionType({
      name: 'SomeUnion',
      types: [],
    });
    expect(someUnion.toConfig()).to.deep.equal({
      name: 'SomeUnion',
      description: undefined,
      types: [],
      resolveType: undefined,
      extensions: {},
      astNode: undefined,
      extensionASTNodes: [],
    });
  });

  it('can be converted to a configuration object', () => {
    const someUnionConfig: GraphQLUnionTypeConfig<unknown, unknown> = {
      name: 'SomeUnion',
      description: 'SomeUnion description.',
      types: [ObjectType],
      resolveType: passThroughFunc,
      extensions: {},
      astNode: {} as any,
      extensionASTNodes: [],
    };
    const someUnion = new GraphQLUnionType(someUnionConfig);
    expect(someUnion.toConfig()).to.deep.equal(someUnionConfig);
  });

  it('accepts a Union type defining resolveType', () => {
    expect(
      () =>
        new GraphQLUnionType({
          name: 'SomeUnion',
          types: [ObjectType],
        }),
    ).to.not.throw();
  });

  it('accepts a Union type with array types', () => {
    const unionType = new GraphQLUnionType({
      name: 'SomeUnion',
      types: [ObjectType],
    });
    expect(unionType.getTypes()).to.deep.equal([ObjectType]);
  });

  it('accepts a Union type with function returning an array of types', () => {
    const unionType = new GraphQLUnionType({
      name: 'SomeUnion',
      types: () => [ObjectType],
    });
    expect(unionType.getTypes()).to.deep.equal([ObjectType]);
  });

  it('accepts a Union type without types', () => {
    const unionType = new GraphQLUnionType({
      name: 'SomeUnion',
      types: [],
    });
    expect(unionType.getTypes()).to.deep.equal([]);
  });

  it('rejects an Union type with invalid name', () => {
    expect(
      () => new GraphQLUnionType({ name: 'bad-name', types: [] }),
    ).to.throw('Names must only contain [_a-zA-Z0-9] but "bad-name" does not.');
  });
});

describe('Type System: Enums', () => {
  it('can be converted from a minimal configuration object', () => {
    const someEnum = new GraphQLEnumType({ name: 'SomeEnum', values: {} });
    expect(someEnum.toConfig()).to.deep.equal({
      name: 'SomeEnum',
      description: undefined,
      values: {},
      extensions: {},
      astNode: undefined,
      extensionASTNodes: [],
    });
  });

  it('can be converted to a configuration object', () => {
    const someEnumConfig: GraphQLEnumTypeConfig = {
      name: 'SomeEnum',
      description: 'SomeEnum description.',
      values: {
        FOO: {
          description: 'FOO description.',
          value: 'foo',
          deprecationReason: 'Value deprecation reason.',
          extensions: { someExtension: 'extension' },
          astNode: dummyAny,
        },
      },
      extensions: { someExtension: 'extension' },
      astNode: dummyAny,
      extensionASTNodes: [dummyAny],
    };
    const someEnum = new GraphQLEnumType(someEnumConfig);
    expect(someEnum.toConfig()).to.deep.equal(someEnumConfig);
  });

  it('can be coerced to an output value via serialize() method', () => {
    const someEnum = new GraphQLEnumType({
      name: 'SomeEnum',
      values: {
        FOO: {
          value: 'foo',
        },
      },
    });
    expect(someEnum.serialize('foo')).to.equal('FOO');
  });

  it('can be coerced to an input value via parseValue() method', () => {
    const someEnum = new GraphQLEnumType({
      name: 'SomeEnum',
      values: {
        FOO: {
          value: 'foo',
        },
      },
    });
    expect(someEnum.parseValue('FOO')).to.equal('foo');
  });

  it('defines an enum type with deprecated value', () => {
    const EnumTypeWithDeprecatedValue = new GraphQLEnumType({
      name: 'EnumWithDeprecatedValue',
      values: {
        foo: { deprecationReason: 'Just because' },
        bar: { deprecationReason: '' },
      },
    });

    expect(EnumTypeWithDeprecatedValue.getValues()[0]).to.include({
      name: 'foo',
      deprecationReason: 'Just because',
    });

    expect(EnumTypeWithDeprecatedValue.getValues()[1]).to.include({
      name: 'bar',
      deprecationReason: '',
    });
  });

  it('defines an enum type with a value of `null` and `undefined`', () => {
    const EnumTypeWithNullishValue = new GraphQLEnumType({
      name: 'EnumWithNullishValue',
      values: {
        NULL: { value: null },
        NAN: { value: NaN },
        NO_CUSTOM_VALUE: { value: undefined },
      },
    });

    const values = EnumTypeWithNullishValue.getValues();

    expect(values).to.have.lengthOf(3);

    expect(values[0]).to.deep.include({
      name: 'NULL',
      description: undefined,
      value: null,
      deprecationReason: undefined,
      extensions: {},
      astNode: undefined,
    });

    expect(values[1]).to.deep.include({
      name: 'NAN',
      description: undefined,
      value: NaN,
      deprecationReason: undefined,
      extensions: {},
      astNode: undefined,
    });

    expect(values[2]).to.deep.include({
      name: 'NO_CUSTOM_VALUE',
      description: undefined,
      value: 'NO_CUSTOM_VALUE',
      deprecationReason: undefined,
      extensions: {},
      astNode: undefined,
    });
  });

  it('accepts a well defined Enum type with empty value definition', () => {
    const enumType = new GraphQLEnumType({
      name: 'SomeEnum',
      values: {
        FOO: {},
        BAR: {},
      },
    });
    expect(enumType.getValue('FOO')).has.property('value', 'FOO');
    expect(enumType.getValue('BAR')).has.property('value', 'BAR');
  });

  it('accepts a well defined Enum type with internal value definition', () => {
    const enumType = new GraphQLEnumType({
      name: 'SomeEnum',
      values: {
        FOO: { value: 10 },
        BAR: { value: 20 },
      },
    });
    expect(enumType.getValue('FOO')).has.property('value', 10);
    expect(enumType.getValue('BAR')).has.property('value', 20);
  });

  it('rejects an Enum type with invalid name', () => {
    expect(
      () => new GraphQLEnumType({ name: 'bad-name', values: {} }),
    ).to.throw('Names must only contain [_a-zA-Z0-9] but "bad-name" does not.');
  });

  it('rejects an Enum type with incorrectly named values', () => {
    expect(
      () =>
        new GraphQLEnumType({
          name: 'SomeEnum',
          values: {
            'bad-name': {},
          },
        }),
    ).to.throw('Names must only contain [_a-zA-Z0-9] but "bad-name" does not.');
  });
});

describe('Type System: Input Objects', () => {
  it('can be converted from a minimal configuration object', () => {
    const inputObject = new GraphQLInputObjectType({
      name: 'SomeInputObject',
      fields: {},
    });
    expect(inputObject.toConfig()).to.deep.equal({
      name: 'SomeInputObject',
      description: undefined,
      fields: {},
      isOneOf: false,
      extensions: {},
      astNode: undefined,
      extensionASTNodes: [],
    });
  });

  it('can be converted to a configuration object', () => {
    const someInputObjectConfig: GraphQLInputObjectTypeConfig = {
      name: 'SomeInputObject',
      description: 'SomeObject description.',
      fields: {
        input: {
          description: 'Argument description.',
          type: ScalarType,
          defaultValue: undefined,
          default: { value: 'DefaultValue' },
          deprecationReason: 'Argument deprecation reason.',
          extensions: { someExtension: 'extension' },
          astNode: dummyAny,
        },
      },
      isOneOf: true,
      extensions: { someExtension: 'extension' },
      astNode: dummyAny,
      extensionASTNodes: [dummyAny],
    };
    const someInputObject = new GraphQLInputObjectType(someInputObjectConfig);
    expect(someInputObject.toConfig()).to.deep.equal(someInputObjectConfig);
  });

  describe('Input Objects must have fields', () => {
    it('accepts an Input Object type with fields', () => {
      const inputObjType = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields: {
          f: { type: ScalarType },
        },
      });
      expect(inputObjType.getFields().f).to.deep.include({
        parentType: inputObjType,
        name: 'f',
        description: undefined,
        type: ScalarType,
        defaultValue: undefined,
        default: undefined,
        deprecationReason: undefined,
        extensions: {},
        astNode: undefined,
      });
    });

    it('accepts an Input Object type with a field function', () => {
      const inputObjType = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields: () => ({
          f: { type: ScalarType },
        }),
      });
      expect(inputObjType.getFields().f).to.deep.include({
        parentType: inputObjType,
        name: 'f',
        description: undefined,
        type: ScalarType,
        defaultValue: undefined,
        default: undefined,
        extensions: {},
        deprecationReason: undefined,
        astNode: undefined,
      });
    });

    it('rejects an Input Object type with invalid name', () => {
      expect(
        () => new GraphQLInputObjectType({ name: 'bad-name', fields: {} }),
      ).to.throw(
        'Names must only contain [_a-zA-Z0-9] but "bad-name" does not.',
      );
    });

    it('rejects an Input Object type with incorrectly named fields', () => {
      const inputObjType = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields: {
          'bad-name': { type: ScalarType },
        },
      });
      expect(() => inputObjType.getFields()).to.throw(
        'Names must only contain [_a-zA-Z0-9] but "bad-name" does not.',
      );
    });
  });

  it('Deprecation reason is preserved on fields', () => {
    const inputObjType = new GraphQLInputObjectType({
      name: 'SomeInputObject',
      fields: {
        deprecatedField: {
          type: ScalarType,
          deprecationReason: 'not used anymore',
        },
      },
    });
    expect(inputObjType.toConfig()).to.have.nested.property(
      'fields.deprecatedField.deprecationReason',
      'not used anymore',
    );
  });

  describe('Input Object fields may have default values', () => {
    it('accepts an Input Object type with a default value', () => {
      const inputObjType = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields: {
          f: { type: ScalarType, default: { value: 3 } },
        },
      });
      expect(inputObjType.getFields().f).to.deep.include({
        name: 'f',
        description: undefined,
        type: ScalarType,
        defaultValue: undefined,
        default: { value: 3 },
        deprecationReason: undefined,
        extensions: {},
        astNode: undefined,
      });
    });

    it('accepts an Input Object type with a default value literal', () => {
      const inputObjType = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields: {
          f: {
            type: ScalarType,
            default: { literal: { kind: Kind.INT, value: '3' } },
          },
        },
      });
      expect(inputObjType.getFields().f).to.deep.include({
        name: 'f',
        description: undefined,
        type: ScalarType,
        defaultValue: undefined,
        default: { literal: { kind: 'IntValue', value: '3' } },
        deprecationReason: undefined,
        extensions: {},
        astNode: undefined,
      });
    });
  });
});

describe('Type System: List', () => {
  function expectList(type: GraphQLType) {
    return expect(() => new GraphQLList(type));
  }

  it('accepts a type as item type of list', () => {
    expectList(ScalarType).to.not.throw();
    expectList(ObjectType).to.not.throw();
    expectList(UnionType).to.not.throw();
    expectList(InterfaceType).to.not.throw();
    expectList(EnumType).to.not.throw();
    expectList(InputObjectType).to.not.throw();
    expectList(ListOfScalarsType).to.not.throw();
    expectList(NonNullScalarType).to.not.throw();
  });
});

describe('Type System: Non-Null', () => {
  function expectNonNull(type: GraphQLNullableType) {
    return expect(() => new GraphQLNonNull(type));
  }

  it('accepts a type as nullable type of non-null', () => {
    expectNonNull(ScalarType).to.not.throw();
    expectNonNull(ObjectType).to.not.throw();
    expectNonNull(UnionType).to.not.throw();
    expectNonNull(InterfaceType).to.not.throw();
    expectNonNull(EnumType).to.not.throw();
    expectNonNull(InputObjectType).to.not.throw();
    expectNonNull(ListOfScalarsType).to.not.throw();
    expectNonNull(ListOfNonNullScalarsType).to.not.throw();
  });
});

describe('Type System: test utility methods', () => {
  const someField = ObjectType.getFields().someField;
  const someArg = someField.args[0];
  const enumValue = EnumType.getValue('foo');
  const someInputField = InputObjectType.getFields().someInputField;

  it('stringifies schema elements', () => {
    expect(String(ScalarType)).to.equal('Scalar');
    expect(String(ObjectType)).to.equal('Object');
    expect(String(someField)).to.equal('Object.someField');
    expect(String(someArg)).to.equal('Object.someField(someArg:)');
    expect(String(InterfaceType)).to.equal('Interface');
    expect(String(UnionType)).to.equal('Union');
    expect(String(EnumType)).to.equal('Enum');
    expect(String(enumValue)).to.equal('Enum.foo');
    expect(String(InputObjectType)).to.equal('InputObject');
    expect(String(someInputField)).to.equal('InputObject.someInputField');

    expect(String(NonNullScalarType)).to.equal('Scalar!');
    expect(String(ListOfScalarsType)).to.equal('[Scalar]');
    expect(String(NonNullListOfScalars)).to.equal('[Scalar]!');
    expect(String(ListOfNonNullScalarsType)).to.equal('[Scalar!]');
    expect(String(new GraphQLList(ListOfScalarsType))).to.equal('[[Scalar]]');
  });

  it('JSON.stringifies types', () => {
    expect(JSON.stringify(ScalarType)).to.equal('"Scalar"');
    expect(JSON.stringify(ObjectType)).to.equal('"Object"');
    expect(JSON.stringify(someField)).to.equal('"Object.someField"');
    expect(JSON.stringify(someArg)).to.equal('"Object.someField(someArg:)"');
    expect(JSON.stringify(UnionType)).to.equal('"Union"');
    expect(JSON.stringify(EnumType)).to.equal('"Enum"');
    expect(JSON.stringify(enumValue)).to.equal('"Enum.foo"');
    expect(JSON.stringify(InputObjectType)).to.equal('"InputObject"');
    expect(JSON.stringify(someInputField)).to.equal(
      '"InputObject.someInputField"',
    );

    expect(JSON.stringify(NonNullScalarType)).to.equal('"Scalar!"');
    expect(JSON.stringify(ListOfScalarsType)).to.equal('"[Scalar]"');
    expect(JSON.stringify(NonNullListOfScalars)).to.equal('"[Scalar]!"');
    expect(JSON.stringify(ListOfNonNullScalarsType)).to.equal('"[Scalar!]"');
    expect(JSON.stringify(new GraphQLList(ListOfScalarsType))).to.equal(
      '"[[Scalar]]"',
    );
  });

  it('Object.toStringifies types', () => {
    function toString(obj: unknown): string {
      return Object.prototype.toString.call(obj);
    }

    expect(toString(ScalarType)).to.equal('[object GraphQLScalarType]');
    expect(toString(ObjectType)).to.equal('[object GraphQLObjectType]');
    expect(toString(InterfaceType)).to.equal('[object GraphQLInterfaceType]');
    expect(toString(UnionType)).to.equal('[object GraphQLUnionType]');
    expect(toString(EnumType)).to.equal('[object GraphQLEnumType]');
    expect(toString(InputObjectType)).to.equal(
      '[object GraphQLInputObjectType]',
    );
    expect(toString(NonNullScalarType)).to.equal('[object GraphQLNonNull]');
    expect(toString(ListOfScalarsType)).to.equal('[object GraphQLList]');
  });
});
