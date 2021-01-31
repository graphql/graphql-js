import { expect } from 'chai';
import { describe, it } from 'mocha';

import inspect from '../../jsutils/inspect';
import identityFunc from '../../jsutils/identityFunc';

import { parseValue } from '../../language/parser';

import type { GraphQLType, GraphQLNullableType } from '../definition';
import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
} from '../definition';

const ScalarType = new GraphQLScalarType({ name: 'Scalar' });
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

const ListOfScalarsType = new GraphQLList(ScalarType);
const NonNullScalarType = new GraphQLNonNull(ScalarType);
const ListOfNonNullScalarsType = new GraphQLList(NonNullScalarType);
const NonNullListOfScalars = new GraphQLNonNull(ListOfScalarsType);

// istanbul ignore next (Never called and used as a placeholder)
const dummyFunc = () => {
  /* empty */
};

describe('Type System: Scalars', () => {
  it('accepts a Scalar type defining serialize', () => {
    expect(() => new GraphQLScalarType({ name: 'SomeScalar' })).to.not.throw();
  });

  it('accepts a Scalar type defining specifiedByUrl', () => {
    expect(
      () =>
        new GraphQLScalarType({
          name: 'SomeScalar',
          specifiedByUrl: 'https://example.com/foo_spec',
        }),
    ).not.to.throw();
  });

  it('accepts a Scalar type defining parseValue and parseLiteral', () => {
    expect(
      () =>
        new GraphQLScalarType({
          name: 'SomeScalar',
          parseValue: dummyFunc,
          parseLiteral: dummyFunc,
        }),
    ).to.not.throw();
  });

  it('provides default methods if omitted', () => {
    const scalar = new GraphQLScalarType({ name: 'Foo' });

    expect(scalar.serialize).to.equal(identityFunc);
    expect(scalar.parseValue).to.equal(identityFunc);
    expect(scalar.parseLiteral).to.be.a('function');
  });

  it('use parseValue for parsing literals if parseLiteral omitted', () => {
    const scalar = new GraphQLScalarType({
      name: 'Foo',
      parseValue(value) {
        return 'parseValue: ' + inspect(value);
      },
    });

    expect(scalar.parseLiteral(parseValue('null'))).to.equal(
      'parseValue: null',
    );
    expect(scalar.parseLiteral(parseValue('{ foo: "bar" }'))).to.equal(
      'parseValue: { foo: "bar" }',
    );
    expect(
      scalar.parseLiteral(parseValue('{ foo: { bar: $var } }'), { var: 'baz' }),
    ).to.equal('parseValue: { foo: { bar: "baz" } }');
  });

  it('rejects a Scalar type without name', () => {
    // $FlowExpectedError[prop-missing]
    expect(() => new GraphQLScalarType({})).to.throw('Must provide name.');
  });

  it('rejects a Scalar type defining serialize with an incorrect type', () => {
    expect(
      () =>
        new GraphQLScalarType({
          name: 'SomeScalar',
          // $FlowExpectedError[prop-missing]
          serialize: {},
        }),
    ).to.throw(
      'SomeScalar must provide "serialize" function. If this custom Scalar is also used as an input type, ensure "parseValue" and "parseLiteral" functions are also provided.',
    );
  });

  it('rejects a Scalar type defining parseLiteral but not parseValue', () => {
    expect(
      () =>
        new GraphQLScalarType({
          name: 'SomeScalar',
          parseLiteral: dummyFunc,
        }),
    ).to.throw(
      'SomeScalar must provide both "parseValue" and "parseLiteral" functions.',
    );
  });

  it('rejects a Scalar type defining parseValue and parseLiteral with an incorrect type', () => {
    expect(
      () =>
        new GraphQLScalarType({
          name: 'SomeScalar',
          // $FlowExpectedError[prop-missing]
          parseValue: {},
          // $FlowExpectedError[prop-missing]
          parseLiteral: {},
        }),
    ).to.throw(
      'SomeScalar must provide both "parseValue" and "parseLiteral" functions.',
    );
  });

  it('rejects a Scalar type defining specifiedByUrl with an incorrect type', () => {
    expect(
      () =>
        new GraphQLScalarType({
          name: 'SomeScalar',
          // $FlowExpectedError[incompatible-call]
          specifiedByUrl: {},
        }),
    ).to.throw(
      'SomeScalar must provide "specifiedByUrl" as a string, but got: {}.',
    );
  });
});

describe('Type System: Objects', () => {
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

    expect(testObject1.getFields()).to.deep.equal(testObject2.getFields());
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

    expect(testInputObject1.getFields()).to.deep.equal(
      testInputObject2.getFields(),
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
    expect(objType.getFields()).to.deep.equal({
      f: {
        name: 'f',
        description: undefined,
        type: ScalarType,
        args: [],
        resolve: undefined,
        subscribe: undefined,
        deprecationReason: undefined,
        extensions: undefined,
        astNode: undefined,
      },
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
    expect(objType.getFields()).to.deep.equal({
      f: {
        name: 'f',
        description: undefined,
        type: ScalarType,
        args: [
          {
            name: 'arg',
            description: undefined,
            type: ScalarType,
            defaultValue: undefined,
            deprecationReason: undefined,
            extensions: undefined,
            astNode: undefined,
          },
        ],
        resolve: undefined,
        subscribe: undefined,
        deprecationReason: undefined,
        extensions: undefined,
        astNode: undefined,
      },
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
          resolve: dummyFunc,
        },
      },
    });
    expect(() => objType.getFields()).to.not.throw();
  });

  it('rejects an Object type without name', () => {
    // $FlowExpectedError[prop-missing]
    expect(() => new GraphQLObjectType({})).to.throw('Must provide name.');
  });

  it('rejects an Object type field with undefined config', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {
        // $FlowExpectedError[incompatible-call]
        f: undefined,
      },
    });
    expect(() => objType.getFields()).to.throw(
      'SomeObject.f field config must be an object.',
    );
  });

  it('rejects an Object type with incorrectly typed fields', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      // $FlowExpectedError[incompatible-call]
      fields: [{ field: ScalarType }],
    });
    expect(() => objType.getFields()).to.throw(
      'SomeObject fields must be an object with field names as keys or a function which returns such an object.',
    );
  });

  it('rejects an Object type with a field function that returns incorrect type', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      fields() {
        // $FlowExpectedError[incompatible-call]
        return [{ field: ScalarType }];
      },
    });
    expect(() => objType.getFields()).to.throw();
  });

  it('rejects an Object type with incorrectly typed field args', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {
        badField: {
          type: ScalarType,
          // $FlowExpectedError[incompatible-call]
          args: [{ badArg: ScalarType }],
        },
      },
    });
    expect(() => objType.getFields()).to.throw(
      'SomeObject.badField args must be an object with argument names as keys.',
    );
  });

  it('rejects an Object type with incorrectly typed interfaces', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {},
      // $FlowExpectedError[incompatible-call]
      interfaces: {},
    });
    expect(() => objType.getInterfaces()).to.throw(
      'SomeObject interfaces must be an Array or a function which returns an Array.',
    );
  });

  it('rejects an Object type with interfaces as a function returning an incorrect type', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {},
      interfaces() {
        // $FlowExpectedError[incompatible-call]
        return {};
      },
    });
    expect(() => objType.getInterfaces()).to.throw(
      'SomeObject interfaces must be an Array or a function which returns an Array.',
    );
  });

  it('rejects an empty Object field resolver', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      // $FlowExpectedError[incompatible-call]
      fields: {
        field: { type: ScalarType, resolve: {} },
      },
    });

    expect(() => objType.getFields()).to.throw(
      'SomeObject.field field resolver must be a function if provided, but got: {}.',
    );
  });

  it('rejects a constant scalar value resolver', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      // $FlowExpectedError[incompatible-call]
      fields: {
        field: { type: ScalarType, resolve: 0 },
      },
    });

    expect(() => objType.getFields()).to.throw(
      'SomeObject.field field resolver must be a function if provided, but got: 0.',
    );
  });

  it('rejects an Object type with an incorrect type for isTypeOf', () => {
    expect(
      () =>
        new GraphQLObjectType({
          name: 'AnotherObject',
          fields: {},
          // $FlowExpectedError[prop-missing]
          isTypeOf: {},
        }),
    ).to.throw(
      'AnotherObject must provide "isTypeOf" as a function, but got: {}.',
    );
  });
});

describe('Type System: Interfaces', () => {
  it('accepts an Interface type defining resolveType', () => {
    expect(
      () =>
        new GraphQLInterfaceType({
          name: 'AnotherInterface',
          fields: { f: { type: ScalarType } },
        }),
    ).to.not.throw();
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

  it('rejects an Interface type without name', () => {
    // $FlowExpectedError[prop-missing]
    expect(() => new GraphQLInterfaceType({})).to.throw('Must provide name.');
  });

  it('rejects an Interface type with incorrectly typed interfaces', () => {
    const objType = new GraphQLInterfaceType({
      name: 'AnotherInterface',
      fields: {},
      // $FlowExpectedError[incompatible-call]
      interfaces: {},
    });
    expect(() => objType.getInterfaces()).to.throw(
      'AnotherInterface interfaces must be an Array or a function which returns an Array.',
    );
  });

  it('rejects an Interface type with interfaces as a function returning an incorrect type', () => {
    const objType = new GraphQLInterfaceType({
      name: 'AnotherInterface',
      fields: {},
      interfaces() {
        // $FlowExpectedError[incompatible-call]
        return {};
      },
    });
    expect(() => objType.getInterfaces()).to.throw(
      'AnotherInterface interfaces must be an Array or a function which returns an Array.',
    );
  });

  it('rejects an Interface type with an incorrect type for resolveType', () => {
    expect(
      () =>
        new GraphQLInterfaceType({
          name: 'AnotherInterface',
          fields: {},
          // $FlowExpectedError[prop-missing]
          resolveType: {},
        }),
    ).to.throw(
      'AnotherInterface must provide "resolveType" as a function, but got: {}.',
    );
  });
});

describe('Type System: Unions', () => {
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

  it('rejects an Union type without name', () => {
    // $FlowExpectedError[prop-missing]
    expect(() => new GraphQLUnionType({})).to.throw('Must provide name.');
  });

  it('rejects an Union type with an incorrect type for resolveType', () => {
    expect(
      () =>
        new GraphQLUnionType({
          name: 'SomeUnion',
          types: [],
          // $FlowExpectedError[prop-missing]
          resolveType: {},
        }),
    ).to.throw(
      'SomeUnion must provide "resolveType" as a function, but got: {}.',
    );
  });

  it('rejects a Union type with incorrectly typed types', () => {
    const unionType = new GraphQLUnionType({
      name: 'SomeUnion',
      // $FlowExpectedError[incompatible-call]
      types: { ObjectType },
    });

    expect(() => unionType.getTypes()).to.throw(
      'Must provide Array of types or a function which returns such an array for Union SomeUnion.',
    );
  });
});

describe('Type System: Enums', () => {
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

    expect(EnumTypeWithNullishValue.getValues()).to.deep.equal([
      {
        name: 'NULL',
        description: undefined,
        value: null,
        deprecationReason: undefined,
        extensions: undefined,
        astNode: undefined,
      },
      {
        name: 'NAN',
        description: undefined,
        value: NaN,
        deprecationReason: undefined,
        extensions: undefined,
        astNode: undefined,
      },
      {
        name: 'NO_CUSTOM_VALUE',
        description: undefined,
        value: 'NO_CUSTOM_VALUE',
        deprecationReason: undefined,
        extensions: undefined,
        astNode: undefined,
      },
    ]);
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

  it('rejects an Enum type without name', () => {
    // $FlowExpectedError[prop-missing]
    expect(() => new GraphQLEnumType({ values: {} })).to.throw(
      'Must provide name.',
    );
  });

  it('rejects an Enum type with incorrectly typed values', () => {
    expect(
      () =>
        new GraphQLEnumType({
          name: 'SomeEnum',
          // $FlowExpectedError[incompatible-call]
          values: [{ FOO: 10 }],
        }),
    ).to.throw('SomeEnum values must be an object with value names as keys.');
  });

  it('rejects an Enum type with missing value definition', () => {
    expect(
      () =>
        new GraphQLEnumType({
          name: 'SomeEnum',
          // $FlowExpectedError[incompatible-call]
          values: { FOO: null },
        }),
    ).to.throw(
      'SomeEnum.FOO must refer to an object with a "value" key representing an internal value but got: null.',
    );
  });

  it('rejects an Enum type with incorrectly typed value definition', () => {
    expect(
      () =>
        new GraphQLEnumType({
          name: 'SomeEnum',
          // $FlowExpectedError[incompatible-call]
          values: { FOO: 10 },
        }),
    ).to.throw(
      'SomeEnum.FOO must refer to an object with a "value" key representing an internal value but got: 10.',
    );
  });
});

describe('Type System: Input Objects', () => {
  describe('Input Objects must have fields', () => {
    it('accepts an Input Object type with fields', () => {
      const inputObjType = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields: {
          f: { type: ScalarType },
        },
      });
      expect(inputObjType.getFields()).to.deep.equal({
        f: {
          name: 'f',
          description: undefined,
          type: ScalarType,
          defaultValue: undefined,
          deprecationReason: undefined,
          extensions: undefined,
          astNode: undefined,
        },
      });
    });

    it('accepts an Input Object type with a field function', () => {
      const inputObjType = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields: () => ({
          f: { type: ScalarType },
        }),
      });
      expect(inputObjType.getFields()).to.deep.equal({
        f: {
          name: 'f',
          description: undefined,
          type: ScalarType,
          defaultValue: undefined,
          extensions: undefined,
          deprecationReason: undefined,
          astNode: undefined,
        },
      });
    });

    it('rejects an Input Object type without name', () => {
      // $FlowExpectedError[prop-missing]
      expect(() => new GraphQLInputObjectType({})).to.throw(
        'Must provide name.',
      );
    });

    it('rejects an Input Object type with incorrect fields', () => {
      const inputObjType = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        // $FlowExpectedError[incompatible-call]
        fields: [],
      });
      expect(() => inputObjType.getFields()).to.throw(
        'SomeInputObject fields must be an object with field names as keys or a function which returns such an object.',
      );
    });

    it('rejects an Input Object type with fields function that returns incorrect type', () => {
      const inputObjType = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        // $FlowExpectedError[incompatible-call]
        fields: () => [],
      });
      expect(() => inputObjType.getFields()).to.throw(
        'SomeInputObject fields must be an object with field names as keys or a function which returns such an object.',
      );
    });
  });

  describe('Input Object fields must not have resolvers', () => {
    it('rejects an Input Object type with resolvers', () => {
      const inputObjType = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        // $FlowExpectedError[incompatible-call]
        fields: {
          f: { type: ScalarType, resolve: dummyFunc },
        },
      });
      expect(() => inputObjType.getFields()).to.throw(
        'SomeInputObject.f field has a resolve property, but Input Types cannot define resolvers.',
      );
    });

    it('rejects an Input Object type with resolver constant', () => {
      const inputObjType = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        // $FlowExpectedError[incompatible-call]
        fields: {
          f: { type: ScalarType, resolve: {} },
        },
      });
      expect(() => inputObjType.getFields()).to.throw(
        'SomeInputObject.f field has a resolve property, but Input Types cannot define resolvers.',
      );
    });
  });
});

describe('Type System: List', () => {
  function expectList(type: GraphQLType) {
    return expect(() => new GraphQLList(type));
  }

  it('accepts an type as item type of list', () => {
    expectList(ScalarType).to.not.throw();
    expectList(ObjectType).to.not.throw();
    expectList(UnionType).to.not.throw();
    expectList(InterfaceType).to.not.throw();
    expectList(EnumType).to.not.throw();
    expectList(InputObjectType).to.not.throw();
    expectList(ListOfScalarsType).to.not.throw();
    expectList(NonNullScalarType).to.not.throw();
  });

  it('rejects a non-type as item type of list', () => {
    // $FlowExpectedError[incompatible-call]
    expectList({}).to.throw('Expected {} to be a GraphQL type.');
    // $FlowExpectedError[incompatible-call]
    expectList(String).to.throw(
      'Expected [function String] to be a GraphQL type.',
    );
    // $FlowExpectedError[incompatible-call]
    expectList(null).to.throw('Expected null to be a GraphQL type.');
    // $FlowExpectedError[incompatible-call]
    expectList(undefined).to.throw('Expected undefined to be a GraphQL type.');
  });
});

describe('Type System: Non-Null', () => {
  function expectNonNull(type: GraphQLNullableType) {
    return expect(() => new GraphQLNonNull(type));
  }

  it('accepts an type as nullable type of non-null', () => {
    expectNonNull(ScalarType).to.not.throw();
    expectNonNull(ObjectType).to.not.throw();
    expectNonNull(UnionType).to.not.throw();
    expectNonNull(InterfaceType).to.not.throw();
    expectNonNull(EnumType).to.not.throw();
    expectNonNull(InputObjectType).to.not.throw();
    expectNonNull(ListOfScalarsType).to.not.throw();
    expectNonNull(ListOfNonNullScalarsType).to.not.throw();
  });

  it('rejects a non-type as nullable type of non-null', () => {
    // $FlowExpectedError[incompatible-call]
    expectNonNull(NonNullScalarType).to.throw(
      'Expected Scalar! to be a GraphQL nullable type.',
    );
    // $FlowExpectedError[incompatible-call]
    expectNonNull({}).to.throw('Expected {} to be a GraphQL nullable type.');
    // $FlowExpectedError[incompatible-call]
    expectNonNull(String).to.throw(
      'Expected [function String] to be a GraphQL nullable type.',
    );
    // $FlowExpectedError[incompatible-call]
    expectNonNull(null).to.throw(
      'Expected null to be a GraphQL nullable type.',
    );
    // $FlowExpectedError[incompatible-call]
    expectNonNull(undefined).to.throw(
      'Expected undefined to be a GraphQL nullable type.',
    );
  });
});

describe('Type System: test utility methods', () => {
  it('stringifies types', () => {
    expect(String(ScalarType)).to.equal('Scalar');
    expect(String(ObjectType)).to.equal('Object');
    expect(String(InterfaceType)).to.equal('Interface');
    expect(String(UnionType)).to.equal('Union');
    expect(String(EnumType)).to.equal('Enum');
    expect(String(InputObjectType)).to.equal('InputObject');

    expect(String(NonNullScalarType)).to.equal('Scalar!');
    expect(String(ListOfScalarsType)).to.equal('[Scalar]');
    expect(String(NonNullListOfScalars)).to.equal('[Scalar]!');
    expect(String(ListOfNonNullScalarsType)).to.equal('[Scalar!]');
    expect(String(new GraphQLList(ListOfScalarsType))).to.equal('[[Scalar]]');
  });

  it('JSON.stringifies types', () => {
    expect(JSON.stringify(ScalarType)).to.equal('"Scalar"');
    expect(JSON.stringify(ObjectType)).to.equal('"Object"');
    expect(JSON.stringify(InterfaceType)).to.equal('"Interface"');
    expect(JSON.stringify(UnionType)).to.equal('"Union"');
    expect(JSON.stringify(EnumType)).to.equal('"Enum"');
    expect(JSON.stringify(InputObjectType)).to.equal('"InputObject"');

    expect(JSON.stringify(NonNullScalarType)).to.equal('"Scalar!"');
    expect(JSON.stringify(ListOfScalarsType)).to.equal('"[Scalar]"');
    expect(JSON.stringify(NonNullListOfScalars)).to.equal('"[Scalar]!"');
    expect(JSON.stringify(ListOfNonNullScalarsType)).to.equal('"[Scalar!]"');
    expect(JSON.stringify(new GraphQLList(ListOfScalarsType))).to.equal(
      '"[[Scalar]]"',
    );
  });

  it('Object.toStringifies types', () => {
    function toString(obj: mixed): string {
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
