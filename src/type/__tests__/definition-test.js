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
  type GraphQLType,
  type GraphQLNullableType,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from '../definition';

const ScalarType = new GraphQLScalarType({ name: 'Scalar', serialize() {} });
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

const ListOfScalarsType = GraphQLList(ScalarType);
const NonNullScalarType = GraphQLNonNull(ScalarType);
const ListOfNonNullScalarsType = GraphQLList(NonNullScalarType);
const NonNullListofScalars = GraphQLNonNull(ListOfScalarsType);

describe('Type System: Scalars', () => {
  it('accepts a Scalar type defining serialize', () => {
    expect(
      () =>
        new GraphQLScalarType({
          name: 'SomeScalar',
          serialize: () => null,
        }),
    ).not.to.throw();
  });

  it('accepts a Scalar type defining parseValue and parseLiteral', () => {
    expect(
      () =>
        new GraphQLScalarType({
          name: 'SomeScalar',
          serialize: () => null,
          parseValue: () => null,
          parseLiteral: () => null,
        }),
    ).not.to.throw();
  });

  it('rejects a Scalar type not defining serialize', () => {
    expect(
      // $DisableFlowOnNegativeTest
      () => new GraphQLScalarType({ name: 'SomeScalar' }),
    ).to.throw(
      'SomeScalar must provide "serialize" function. If this custom Scalar is also used as an input type, ensure "parseValue" and "parseLiteral" functions are also provided.',
    );
  });

  it('rejects a Scalar type defining serialize with an incorrect type', () => {
    expect(
      () =>
        new GraphQLScalarType({
          name: 'SomeScalar',
          // $DisableFlowOnNegativeTest
          serialize: {},
        }),
    ).to.throw(
      'SomeScalar must provide "serialize" function. If this custom Scalar is also used as an input type, ensure "parseValue" and "parseLiteral" functions are also provided.',
    );
  });

  it('rejects a Scalar type defining parseValue but not parseLiteral', () => {
    expect(
      () =>
        new GraphQLScalarType({
          name: 'SomeScalar',
          serialize: () => null,
          parseValue: () => null,
        }),
    ).to.throw(
      'SomeScalar must provide both "parseValue" and "parseLiteral" functions.',
    );
  });

  it('rejects a Scalar type defining parseLiteral but not parseValue', () => {
    expect(
      () =>
        new GraphQLScalarType({
          name: 'SomeScalar',
          serialize: () => null,
          parseLiteral: () => null,
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
          serialize: () => null,
          // $DisableFlowOnNegativeTest
          parseValue: {},
          // $DisableFlowOnNegativeTest
          parseLiteral: {},
        }),
    ).to.throw(
      'SomeScalar must provide both "parseValue" and "parseLiteral" functions.',
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
      },
    });

    expect(TypeWithDeprecatedField.getFields().bar).to.deep.equal({
      type: ScalarType,
      deprecationReason: 'A terrible reason',
      isDeprecated: true,
      name: 'bar',
      args: [],
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
      f: { name: 'f', type: ScalarType, args: [], isDeprecated: false },
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
        type: ScalarType,
        args: [
          {
            name: 'arg',
            type: ScalarType,
            description: null,
            defaultValue: undefined,
            astNode: undefined,
          },
        ],
        isDeprecated: false,
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
          resolve: () => ({}),
        },
      },
    });
    expect(() => objType.getFields()).not.to.throw();
  });

  it('rejects an Object type field with undefined config', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {
        // $DisableFlowOnNegativeTest
        f: undefined,
      },
    });
    expect(() => objType.getFields()).to.throw(
      'SomeObject.f field config must be an object',
    );
  });

  it('rejects an Object type with incorrectly typed fields', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      // $DisableFlowOnNegativeTest
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
        // $DisableFlowOnNegativeTest
        return [{ field: ScalarType }];
      },
    });
    expect(() => objType.getFields()).to.throw(
      'SomeObject fields must be an object with field names as keys or a function which returns such an object.',
    );
  });

  it('rejects an Object type with incorrectly typed field args', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {
        badField: {
          type: ScalarType,
          // $DisableFlowOnNegativeTest
          args: [{ badArg: ScalarType }],
        },
      },
    });
    expect(() => objType.getFields()).to.throw(
      'SomeObject.badField args must be an object with argument names as keys.',
    );
  });

  it('rejects an Object type with an isDeprecated instead of deprecationReason on field', () => {
    const OldObject = new GraphQLObjectType({
      name: 'OldObject',
      fields: {
        // $DisableFlowOnNegativeTest
        field: { type: ScalarType, isDeprecated: true },
      },
    });

    expect(() => OldObject.getFields()).to.throw(
      'OldObject.field should provide "deprecationReason" instead of "isDeprecated".',
    );
  });

  it('rejects an Object type with incorrectly typed interfaces', () => {
    const objType = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {},
      // $DisableFlowOnNegativeTest
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
      // $DisableFlowOnNegativeTest
      interfaces() {
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
      fields: {
        // $DisableFlowOnNegativeTest
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
      fields: {
        // $DisableFlowOnNegativeTest
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
          // $DisableFlowOnNegativeTest
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
    ).not.to.throw();
  });

  it('rejects an Interface type with an incorrect type for resolveType', () => {
    expect(
      () =>
        new GraphQLInterfaceType({
          name: 'AnotherInterface',
          fields: {},
          // $DisableFlowOnNegativeTest
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
    ).not.to.throw();
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

  it('rejects an Union type with an incorrect type for resolveType', () => {
    expect(
      () =>
        new GraphQLUnionType({
          name: 'SomeUnion',
          types: [],
          // $DisableFlowOnNegativeTest
          resolveType: {},
        }),
    ).to.throw(
      'SomeUnion must provide "resolveType" as a function, but got: {}.',
    );
  });

  it('rejects a Union type with incorrectly typed types', () => {
    const unionType = new GraphQLUnionType({
      name: 'SomeUnion',
      // $DisableFlowOnNegativeTest
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
      values: { foo: { deprecationReason: 'Just because' } },
    });

    expect(EnumTypeWithDeprecatedValue.getValues()[0]).to.deep.equal({
      name: 'foo',
      description: undefined,
      isDeprecated: true,
      deprecationReason: 'Just because',
      value: 'foo',
      astNode: undefined,
    });
  });

  it('defines an enum type with a value of `null` and `undefined`', () => {
    const EnumTypeWithNullishValue = new GraphQLEnumType({
      name: 'EnumWithNullishValue',
      values: {
        NULL: { value: null },
        UNDEFINED: { value: undefined },
      },
    });

    expect(EnumTypeWithNullishValue.getValues()).to.deep.equal([
      {
        name: 'NULL',
        description: undefined,
        isDeprecated: false,
        deprecationReason: undefined,
        value: null,
        astNode: undefined,
      },
      {
        name: 'UNDEFINED',
        description: undefined,
        isDeprecated: false,
        deprecationReason: undefined,
        value: undefined,
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

  it('rejects an Enum type with incorrectly typed values', () => {
    expect(
      () =>
        new GraphQLEnumType({
          name: 'SomeEnum',
          // $DisableFlowOnNegativeTest
          values: [{ FOO: 10 }],
        }),
    ).to.throw('SomeEnum values must be an object with value names as keys.');
  });

  it('rejects an Enum type with missing value definition', () => {
    expect(
      () =>
        new GraphQLEnumType({
          name: 'SomeEnum',
          // $DisableFlowOnNegativeTest
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
          // $DisableFlowOnNegativeTest
          values: { FOO: 10 },
        }),
    ).to.throw(
      'SomeEnum.FOO must refer to an object with a "value" key representing an internal value but got: 10.',
    );
  });

  it('does not allow isDeprecated instead of deprecationReason on enum', () => {
    expect(
      () =>
        new GraphQLEnumType({
          name: 'SomeEnum',
          values: {
            // $DisableFlowOnNegativeTest
            FOO: { isDeprecated: true },
          },
        }),
    ).to.throw(
      'SomeEnum.FOO should provide "deprecationReason" instead of "isDeprecated".',
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
        f: { name: 'f', type: ScalarType },
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
        f: { name: 'f', type: ScalarType },
      });
    });

    it('rejects an Input Object type with incorrect fields', () => {
      const inputObjType = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        // $DisableFlowOnNegativeTest
        fields: [],
      });
      expect(() => inputObjType.getFields()).to.throw(
        'SomeInputObject fields must be an object with field names as keys or a function which returns such an object.',
      );
    });

    it('rejects an Input Object type with fields function that returns incorrect type', () => {
      const inputObjType = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        // $DisableFlowOnNegativeTest
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
        fields: {
          // $DisableFlowOnNegativeTest
          f: { type: ScalarType, resolve: () => 0 },
        },
      });
      expect(() => inputObjType.getFields()).to.throw(
        'SomeInputObject.f field has a resolve property, but Input Types cannot define resolvers.',
      );
    });

    it('rejects an Input Object type with resolver constant', () => {
      const inputObjType = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields: {
          // $DisableFlowOnNegativeTest
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
    return expect(() => GraphQLList(type));
  }

  it('accepts an type as item type of list', () => {
    expectList(ScalarType).not.to.throw();
    expectList(ObjectType).not.to.throw();
    expectList(UnionType).not.to.throw();
    expectList(InterfaceType).not.to.throw();
    expectList(EnumType).not.to.throw();
    expectList(InputObjectType).not.to.throw();
    expectList(ListOfScalarsType).not.to.throw();
    expectList(NonNullScalarType).not.to.throw();
  });

  it('rejects a non-type as item type of list', () => {
    // $DisableFlowOnNegativeTest
    expectList({}).to.throw('Expected {} to be a GraphQL type.');
    // $DisableFlowOnNegativeTest
    expectList(String).to.throw(
      'Expected [function String] to be a GraphQL type.',
    );
    // $DisableFlowOnNegativeTest
    expectList(null).to.throw('Expected null to be a GraphQL type.');
    // $DisableFlowOnNegativeTest
    expectList(undefined).to.throw('Expected undefined to be a GraphQL type.');
  });
});

describe('Type System: Non-Null', () => {
  function expectNonNull(type: GraphQLNullableType) {
    return expect(() => GraphQLNonNull(type));
  }

  it('accepts an type as nullable type of non-null', () => {
    expectNonNull(ScalarType).not.to.throw();
    expectNonNull(ObjectType).not.to.throw();
    expectNonNull(UnionType).not.to.throw();
    expectNonNull(InterfaceType).not.to.throw();
    expectNonNull(EnumType).not.to.throw();
    expectNonNull(InputObjectType).not.to.throw();
    expectNonNull(ListOfScalarsType).not.to.throw();
    expectNonNull(ListOfNonNullScalarsType).not.to.throw();
  });

  it('rejects a non-type as nullable type of non-null', () => {
    // $DisableFlowOnNegativeTest
    expectNonNull(NonNullScalarType).to.throw(
      'Expected Scalar! to be a GraphQL nullable type.',
    );
    // $DisableFlowOnNegativeTest
    expectNonNull({}).to.throw('Expected {} to be a GraphQL nullable type.');
    // $DisableFlowOnNegativeTest
    expectNonNull(String).to.throw(
      'Expected [function String] to be a GraphQL nullable type.',
    );
    // $DisableFlowOnNegativeTest
    expectNonNull(null).to.throw(
      'Expected null to be a GraphQL nullable type.',
    );
    // $DisableFlowOnNegativeTest
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
    expect(String(NonNullListofScalars)).to.equal('[Scalar]!');
    expect(String(ListOfNonNullScalarsType)).to.equal('[Scalar!]');
    expect(String(GraphQLList(ListOfScalarsType))).to.equal('[[Scalar]]');
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
    expect(JSON.stringify(NonNullListofScalars)).to.equal('"[Scalar]!"');
    expect(JSON.stringify(ListOfNonNullScalarsType)).to.equal('"[Scalar!]"');
    expect(JSON.stringify(GraphQLList(ListOfScalarsType))).to.equal(
      '"[[Scalar]]"',
    );
  });

  it('Object.toStringifies types', () => {
    function toString(obj) {
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
