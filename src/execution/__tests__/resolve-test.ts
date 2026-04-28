import { expect } from 'chai';
import { describe, it } from 'mocha';

import { Kind } from '../../language/kinds';
import { parse } from '../../language/parser';

import type {
  GraphQLFieldConfig,
  GraphQLResolveInfo,
} from '../../type/definition';
import {
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLUnionType,
} from '../../type/definition';
import { GraphQLInt, GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { executeSync } from '../execute';

describe('Execute: resolve function', () => {
  function testSchema(testField: GraphQLFieldConfig<any, any>) {
    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          test: testField,
        },
      }),
    });
  }

  it('default function accesses properties', () => {
    const result = executeSync({
      schema: testSchema({ type: GraphQLString }),
      document: parse('{ test }'),
      rootValue: { test: 'testValue' },
    });

    expect(result).to.deep.equal({
      data: {
        test: 'testValue',
      },
    });
  });

  it('default function calls methods', () => {
    const rootValue = {
      _secret: 'secretValue',
      test() {
        return this._secret;
      },
    };

    const result = executeSync({
      schema: testSchema({ type: GraphQLString }),
      document: parse('{ test }'),
      rootValue,
    });
    expect(result).to.deep.equal({
      data: {
        test: 'secretValue',
      },
    });
  });

  it('default function passes args and context', () => {
    class Adder {
      _num: number;

      constructor(num: number) {
        this._num = num;
      }

      test(args: { addend1: number }, context: { addend2: number }) {
        return this._num + args.addend1 + context.addend2;
      }
    }
    const rootValue = new Adder(700);

    const schema = testSchema({
      type: GraphQLInt,
      args: {
        addend1: { type: GraphQLInt },
      },
    });
    const contextValue = { addend2: 9 };
    const document = parse('{ test(addend1: 80) }');

    const result = executeSync({ schema, document, rootValue, contextValue });
    expect(result).to.deep.equal({
      data: { test: 789 },
    });
  });

  it('uses provided resolve function', () => {
    const schema = testSchema({
      type: GraphQLString,
      args: {
        aStr: { type: GraphQLString },
        aInt: { type: GraphQLInt },
      },
      resolve: (source, args) => JSON.stringify([source, args]),
    });

    function executeQuery(query: string, rootValue?: unknown) {
      const document = parse(query);
      return executeSync({ schema, document, rootValue });
    }

    expect(executeQuery('{ test }')).to.deep.equal({
      data: {
        test: '[null,{}]',
      },
    });

    expect(executeQuery('{ test }', 'Source!')).to.deep.equal({
      data: {
        test: '["Source!",{}]',
      },
    });

    expect(executeQuery('{ test(aStr: "String!") }', 'Source!')).to.deep.equal({
      data: {
        test: '["Source!",{"aStr":"String!"}]',
      },
    });

    expect(
      executeQuery('{ test(aInt: -123, aStr: "String!") }', 'Source!'),
    ).to.deep.equal({
      data: {
        test: '["Source!",{"aStr":"String!","aInt":-123}]',
      },
    });
  });

  it('provides correct resolve info for nested fields', () => {
    let outerInfo: GraphQLResolveInfo | undefined;
    let innerInfo: GraphQLResolveInfo | undefined;

    const InnerType: GraphQLObjectType = new GraphQLObjectType({
      name: 'Inner',
      fields: {
        value: {
          type: GraphQLString,
          resolve(_source, _args, _context, info) {
            innerInfo = info;
            return 'inner value';
          },
        },
      },
    });

    const OuterType = new GraphQLObjectType({
      name: 'Outer',
      fields: {
        inner: {
          type: InnerType,
          resolve(_source, _args, _context, info) {
            outerInfo = info;
            return {};
          },
        },
      },
    });

    const schema = new GraphQLSchema({ query: OuterType });
    const document = parse('{ inner { value } }');
    const rootValue = {};

    executeSync({ schema, document, rootValue });

    // Outer field resolver info
    expect(outerInfo).to.include({
      fieldName: 'inner',
      returnType: InnerType,
      parentType: OuterType,
    });

    // Inner (nested) field resolver info
    expect(innerInfo).to.include({
      fieldName: 'value',
      returnType: GraphQLString,
      parentType: InnerType,
    });
  });

  it('provides correct returnType for NonNull and List wrappers', () => {
    let nonNullInfo: GraphQLResolveInfo | undefined;
    let listInfo: GraphQLResolveInfo | undefined;
    let nonNullListInfo: GraphQLResolveInfo | undefined;

    const nonNullType = new GraphQLNonNull(GraphQLString);
    const listType = new GraphQLList(GraphQLString);
    const nonNullListType = new GraphQLNonNull(
      new GraphQLList(new GraphQLNonNull(GraphQLString)),
    );

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          nonNullField: {
            type: nonNullType,
            resolve(_source, _args, _context, info) {
              nonNullInfo = info;
              return 'value';
            },
          },
          listField: {
            type: listType,
            resolve(_source, _args, _context, info) {
              listInfo = info;
              return ['a', 'b'];
            },
          },
          nonNullListField: {
            type: nonNullListType,
            resolve(_source, _args, _context, info) {
              nonNullListInfo = info;
              return ['x', 'y'];
            },
          },
        },
      }),
    });

    const document = parse('{ nonNullField listField nonNullListField }');
    executeSync({ schema, document });

    expect(nonNullInfo?.returnType).to.equal(nonNullType);
    expect(listInfo?.returnType).to.equal(listType);
    expect(nonNullListInfo?.returnType).to.equal(nonNullListType);
  });

  it('provides correct fieldNodes including aliases and arguments', () => {
    let info: GraphQLResolveInfo | undefined;

    const schema = testSchema({
      type: GraphQLString,
      args: {
        id: { type: GraphQLInt },
      },
      resolve(_source, _args, _context, _info) {
        info = _info;
        return 'result';
      },
    });

    const document = parse('{ aliased: test(id: 42) }');
    executeSync({ schema, document });

    expect(info?.fieldNodes).to.have.length(1);
    const fieldNode = info?.fieldNodes[0];
    expect(fieldNode?.kind).to.equal(Kind.FIELD);
    expect(fieldNode?.alias?.value).to.equal('aliased');
    expect(fieldNode?.name.value).to.equal('test');
    expect(fieldNode?.arguments).to.have.length(1);
    expect(fieldNode?.arguments?.[0].name.value).to.equal('id');
  });

  it('provides fragments in resolve info', () => {
    let info: GraphQLResolveInfo | undefined;

    const PersonType = new GraphQLObjectType({
      name: 'Person',
      fields: {
        name: {
          type: GraphQLString,
          resolve(_source, _args, _context, _info) {
            info = _info;
            return 'Alice';
          },
        },
        age: { type: GraphQLInt },
      },
    });

    const schema = new GraphQLSchema({ query: PersonType });
    const document = parse(`
      query {
        ...PersonFields
      }
      fragment PersonFields on Person {
        name
      }
    `);

    executeSync({ schema, document, rootValue: {} });

    expect(info?.fragments).to.have.key('PersonFields');
    expect(info?.fragments.PersonFields.kind).to.equal(
      Kind.FRAGMENT_DEFINITION,
    );
    expect(info?.fragments.PersonFields.name.value).to.equal('PersonFields');
  });

  it('provides correct info to resolveType on interface fields', () => {
    let resolveTypeInfo: GraphQLResolveInfo | undefined;

    const AnimalType = new GraphQLInterfaceType({
      name: 'Animal',
      fields: {
        name: { type: GraphQLString },
      },
      resolveType(_source, _context, info) {
        resolveTypeInfo = info;
        return 'Dog';
      },
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [AnimalType],
      fields: {
        name: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          animal: {
            type: AnimalType,
            resolve() {
              return { name: 'Odie' };
            },
          },
        },
      }),
      types: [DogType],
    });

    const document = parse('{ animal { name } }');
    executeSync({ schema, document });

    expect(resolveTypeInfo).to.include({
      fieldName: 'animal',
      parentType: schema.getQueryType(),
      returnType: AnimalType,
    });
    expect(resolveTypeInfo?.fieldNodes).to.have.length(1);
    expect(resolveTypeInfo?.fieldNodes[0].name.value).to.equal('animal');
  });

  it('provides correct info to resolveType on union fields', () => {
    let resolveTypeInfo: GraphQLResolveInfo | undefined;

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      fields: { name: { type: GraphQLString } },
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      fields: { name: { type: GraphQLString } },
    });

    const PetType = new GraphQLUnionType({
      name: 'Pet',
      types: [CatType, DogType],
      resolveType(_source, _context, info) {
        resolveTypeInfo = info;
        return 'Cat';
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          pet: {
            type: PetType,
            resolve() {
              return { name: 'Garfield' };
            },
          },
        },
      }),
    });

    const document = parse('{ pet { ... on Cat { name } } }');
    executeSync({ schema, document });

    expect(resolveTypeInfo).to.include({
      fieldName: 'pet',
      returnType: PetType,
    });
    expect(resolveTypeInfo?.fieldNodes).to.have.length(1);
    expect(resolveTypeInfo?.fieldNodes[0].name.value).to.equal('pet');
  });

  it('provides correct info to isTypeOf', () => {
    let isTypeOfInfo: GraphQLResolveInfo | undefined;

    const AnimalType = new GraphQLInterfaceType({
      name: 'Animal',
      fields: {
        name: { type: GraphQLString },
      },
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [AnimalType],
      fields: {
        name: { type: GraphQLString },
      },
      isTypeOf(_source, _context, info) {
        isTypeOfInfo = info;
        return true;
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          animal: {
            type: AnimalType,
            resolve() {
              return { name: 'Lassie' };
            },
          },
        },
      }),
      types: [DogType],
    });

    const document = parse('{ animal { name } }');
    executeSync({ schema, document });

    expect(isTypeOfInfo).to.include({
      fieldName: 'animal',
      parentType: schema.getQueryType(),
      returnType: AnimalType,
    });
    expect(isTypeOfInfo?.fieldNodes).to.have.length(1);
    expect(isTypeOfInfo?.fieldNodes[0].name.value).to.equal('animal');
  });

  it('provides correct path for deeply nested fields', () => {
    let leafInfo: GraphQLResolveInfo | undefined;

    const LevelTwo = new GraphQLObjectType({
      name: 'LevelTwo',
      fields: {
        value: {
          type: GraphQLString,
          resolve(_source, _args, _context, info) {
            leafInfo = info;
            return 'deep';
          },
        },
      },
    });

    const LevelOne = new GraphQLObjectType({
      name: 'LevelOne',
      fields: {
        child: {
          type: LevelTwo,
          resolve() {
            return {};
          },
        },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          parent: {
            type: LevelOne,
            resolve() {
              return {};
            },
          },
        },
      }),
    });

    const document = parse('{ parent { child { value } } }');
    executeSync({ schema, document });

    expect(leafInfo).to.include({
      fieldName: 'value',
      returnType: GraphQLString,
      parentType: LevelTwo,
    });
    expect(leafInfo?.path).to.deep.equal({
      prev: {
        prev: { prev: undefined, key: 'parent', typename: 'Query' },
        key: 'child',
        typename: 'LevelOne',
      },
      key: 'value',
      typename: 'LevelTwo',
    });
  });

  it('provides variableValues in resolve info', () => {
    let info: GraphQLResolveInfo | undefined;

    const schema = testSchema({
      type: GraphQLString,
      args: {
        greeting: { type: GraphQLString },
      },
      resolve(_source, _args, _context, _info) {
        info = _info;
        return 'hello';
      },
    });

    const document = parse(`
      query TestQuery($greeting: String) {
        test(greeting: $greeting)
      }
    `);
    const variableValues = { greeting: 'bonjour' };

    executeSync({ schema, document, variableValues });

    expect(info?.variableValues).to.deep.equal({ greeting: 'bonjour' });
    expect(info?.operation.kind).to.equal(Kind.OPERATION_DEFINITION);
    expect(info?.operation.name?.value).to.equal('TestQuery');
  });
});
