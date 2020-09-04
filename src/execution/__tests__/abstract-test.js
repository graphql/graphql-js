import { expect } from 'chai';
import { describe, it } from 'mocha';

import invariant from '../../jsutils/invariant';

import { parse } from '../../language/parser';

import { GraphQLSchema } from '../../type/schema';
import { GraphQLString, GraphQLBoolean } from '../../type/scalars';
import {
  GraphQLList,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
} from '../../type/definition';

import { buildSchema } from '../../utilities/buildASTSchema';

import { executeSync, execute } from '../execute';

async function executeQuery(args: {|
  schema: GraphQLSchema,
  query: string,
  rootValue?: mixed,
|}) {
  const { schema, query, rootValue } = args;
  const document = parse(query);
  const result = executeSync({
    schema,
    document,
    rootValue,
    contextValue: { async: false },
  });
  const asyncResult = await execute({
    schema,
    document,
    rootValue,
    contextValue: { async: true },
  });

  expect(result).to.deep.equal(asyncResult);
  return result;
}

class Dog {
  name: string;
  woofs: boolean;

  constructor(name: string, woofs: boolean) {
    this.name = name;
    this.woofs = woofs;
  }
}

class Cat {
  name: string;
  meows: boolean;

  constructor(name: string, meows: boolean) {
    this.name = name;
    this.meows = meows;
  }
}

class Human {
  name: string;

  constructor(name: string) {
    this.name = name;
  }
}

describe('Execute: Handles execution of abstract types', () => {
  it('isTypeOf used to resolve runtime type for Interface', async () => {
    const PetType = new GraphQLInterfaceType({
      name: 'Pet',
      fields: {
        name: { type: GraphQLString },
      },
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [PetType],
      isTypeOf(obj, context) {
        const isDog = obj instanceof Dog;
        return context.async ? Promise.resolve(isDog) : isDog;
      },
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      },
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      interfaces: [PetType],
      isTypeOf(obj, context) {
        const isCat = obj instanceof Cat;
        return context.async ? Promise.resolve(isCat) : isCat;
      },
      fields: {
        name: { type: GraphQLString },
        meows: { type: GraphQLBoolean },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          pets: {
            type: new GraphQLList(PetType),
            resolve() {
              return [new Dog('Odie', true), new Cat('Garfield', false)];
            },
          },
        },
      }),
      types: [CatType, DogType],
    });

    const query = `
      {
        pets {
          name
          ... on Dog {
            woofs
          }
          ... on Cat {
            meows
          }
        }
      }
    `;

    expect(await executeQuery({ schema, query })).to.deep.equal({
      data: {
        pets: [
          {
            name: 'Odie',
            woofs: true,
          },
          {
            name: 'Garfield',
            meows: false,
          },
        ],
      },
    });
  });

  it('isTypeOf can throw', async () => {
    const PetType = new GraphQLInterfaceType({
      name: 'Pet',
      fields: {
        name: { type: GraphQLString },
      },
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [PetType],
      isTypeOf(_source, context) {
        const error = new Error('We are testing this error');
        if (context.async) {
          return Promise.reject(error);
        }
        throw error;
      },
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      },
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      interfaces: [PetType],
      isTypeOf: undefined,
      fields: {
        name: { type: GraphQLString },
        meows: { type: GraphQLBoolean },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          pets: {
            type: new GraphQLList(PetType),
            resolve() {
              return [new Dog('Odie', true), new Cat('Garfield', false)];
            },
          },
        },
      }),
      types: [DogType, CatType],
    });

    const query = `
      {
        pets {
          name
          ... on Dog {
            woofs
          }
          ... on Cat {
            meows
          }
        }
      }
    `;

    expect(await executeQuery({ schema, query })).to.deep.equal({
      data: {
        pets: [null, null],
      },
      errors: [
        {
          message: 'We are testing this error',
          locations: [{ line: 3, column: 9 }],
          path: ['pets', 0],
        },
        {
          message: 'We are testing this error',
          locations: [{ line: 3, column: 9 }],
          path: ['pets', 1],
        },
      ],
    });
  });

  it('isTypeOf used to resolve runtime type for Union', async () => {
    const DogType = new GraphQLObjectType({
      name: 'Dog',
      isTypeOf(obj, context) {
        const isDog = obj instanceof Dog;
        return context.async ? Promise.resolve(isDog) : isDog;
      },
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      },
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      isTypeOf(obj, context) {
        const isCat = obj instanceof Cat;
        return context.async ? Promise.resolve(isCat) : isCat;
      },
      fields: {
        name: { type: GraphQLString },
        meows: { type: GraphQLBoolean },
      },
    });

    const PetType = new GraphQLUnionType({
      name: 'Pet',
      types: [DogType, CatType],
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          pets: {
            type: new GraphQLList(PetType),
            resolve() {
              return [new Dog('Odie', true), new Cat('Garfield', false)];
            },
          },
        },
      }),
    });

    const query = `{
      pets {
        ... on Dog {
          name
          woofs
        }
        ... on Cat {
          name
          meows
        }
      }
    }`;

    expect(await executeQuery({ schema, query })).to.deep.equal({
      data: {
        pets: [
          {
            name: 'Odie',
            woofs: true,
          },
          {
            name: 'Garfield',
            meows: false,
          },
        ],
      },
    });
  });

  it('resolveType on Interface yields useful error', async () => {
    const PetType = new GraphQLInterfaceType({
      name: 'Pet',
      resolveType(obj, context) {
        if (obj instanceof Dog) {
          return context.async ? Promise.resolve(DogType) : DogType;
        }
        if (obj instanceof Cat) {
          return context.async ? Promise.resolve(CatType) : CatType;
        }
        // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')
        if (obj instanceof Human) {
          return context.async ? Promise.resolve(HumanType) : HumanType;
        }

        // istanbul ignore next (Not reachable. All possible types have been considered)
        invariant(false);
      },
      fields: {
        name: { type: GraphQLString },
      },
    });

    const HumanType = new GraphQLObjectType({
      name: 'Human',
      fields: {
        name: { type: GraphQLString },
      },
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [PetType],
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      },
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      interfaces: [PetType],
      fields: {
        name: { type: GraphQLString },
        meows: { type: GraphQLBoolean },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          pets: {
            type: new GraphQLList(PetType),
            resolve() {
              return [
                new Dog('Odie', true),
                new Cat('Garfield', false),
                new Human('Jon'),
              ];
            },
          },
        },
      }),
      types: [CatType, DogType],
    });

    const query = `
      {
        pets {
          name
          ... on Dog {
            woofs
          }
          ... on Cat {
            meows
          }
        }
      }
    `;

    expect(await executeQuery({ schema, query })).to.deep.equal({
      data: {
        pets: [
          {
            name: 'Odie',
            woofs: true,
          },
          {
            name: 'Garfield',
            meows: false,
          },
          null,
        ],
      },
      errors: [
        {
          message:
            'Runtime Object type "Human" is not a possible type for "Pet".',
          locations: [{ line: 3, column: 9 }],
          path: ['pets', 2],
        },
      ],
    });
  });

  it('resolveType on Union yields useful error', async () => {
    const HumanType = new GraphQLObjectType({
      name: 'Human',
      fields: {
        name: { type: GraphQLString },
      },
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      },
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      fields: {
        name: { type: GraphQLString },
        meows: { type: GraphQLBoolean },
      },
    });

    const PetType = new GraphQLUnionType({
      name: 'Pet',
      resolveType(obj, context) {
        if (obj instanceof Dog) {
          return context.async ? Promise.resolve(DogType) : DogType;
        }
        if (obj instanceof Cat) {
          return context.async ? Promise.resolve(CatType) : CatType;
        }
        // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')
        if (obj instanceof Human) {
          return context.async ? Promise.resolve(HumanType) : HumanType;
        }

        // istanbul ignore next (Not reachable. All possible types have been considered)
        invariant(false);
      },
      types: [DogType, CatType],
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          pets: {
            type: new GraphQLList(PetType),
            resolve() {
              return [
                new Dog('Odie', true),
                new Cat('Garfield', false),
                new Human('Jon'),
              ];
            },
          },
        },
      }),
    });

    const query = `
      {
        pets {
          ... on Dog {
            name
            woofs
          }
          ... on Cat {
            name
            meows
          }
        }
      }
    `;

    expect(await executeQuery({ schema, query })).to.deep.equal({
      data: {
        pets: [
          {
            name: 'Odie',
            woofs: true,
          },
          {
            name: 'Garfield',
            meows: false,
          },
          null,
        ],
      },
      errors: [
        {
          message:
            'Runtime Object type "Human" is not a possible type for "Pet".',
          locations: [{ line: 3, column: 9 }],
          path: ['pets', 2],
        },
      ],
    });
  });

  it('returning invalid value from resolveType yields useful error', async () => {
    const fooInterface = new GraphQLInterfaceType({
      name: 'FooInterface',
      fields: { bar: { type: GraphQLString } },
      resolveType(_source, context) {
        // $FlowExpectedError[incompatible-call]
        return context.async ? Promise.resolve([]) : [];
      },
    });

    const fooObject = new GraphQLObjectType({
      name: 'FooObject',
      fields: { bar: { type: GraphQLString } },
      interfaces: [fooInterface],
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          foo: {
            type: fooInterface,
            resolve: () => 'dummy',
          },
        },
      }),
      types: [fooObject],
    });

    expect(
      await executeQuery({ schema, query: '{ foo { bar } }' }),
    ).to.deep.equal({
      data: { foo: null },
      errors: [
        {
          message:
            'Abstract type "FooInterface" must resolve to an Object type at runtime for field "Query.foo" with value "dummy", received "[]". Either the "FooInterface" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.',
          locations: [{ line: 1, column: 3 }],
          path: ['foo'],
        },
      ],
    });
  });

  it('missing both resolveType and isTypeOf yields useful error', async () => {
    const fooInterface = new GraphQLInterfaceType({
      name: 'FooInterface',
      fields: { bar: { type: GraphQLString } },
    });

    const fooObject = new GraphQLObjectType({
      name: 'FooObject',
      fields: { bar: { type: GraphQLString } },
      interfaces: [fooInterface],
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          foo: {
            type: fooInterface,
            resolve: () => 'dummy',
          },
        },
      }),
      types: [fooObject],
    });

    expect(
      await executeQuery({ schema, query: '{ foo { bar } }' }),
    ).to.deep.equal({
      data: { foo: null },
      errors: [
        {
          message:
            'Abstract type "FooInterface" must resolve to an Object type at runtime for field "Query.foo" with value "dummy", received "undefined". Either the "FooInterface" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.',
          locations: [{ line: 1, column: 3 }],
          path: ['foo'],
        },
      ],
    });
  });

  it('resolveType allows resolving with type name', async () => {
    const PetType = new GraphQLInterfaceType({
      name: 'Pet',
      resolveType(obj, context) {
        if (obj instanceof Dog) {
          return context.async ? Promise.resolve('Dog') : 'Dog';
        }
        // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')
        if (obj instanceof Cat) {
          return context.async ? Promise.resolve('Cat') : 'Cat';
        }

        // istanbul ignore next (Not reachable. All possible types have been considered)
        invariant(false);
      },
      fields: {
        name: { type: GraphQLString },
      },
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [PetType],
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      },
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      interfaces: [PetType],
      fields: {
        name: { type: GraphQLString },
        meows: { type: GraphQLBoolean },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          pets: {
            type: new GraphQLList(PetType),
            resolve() {
              return [new Dog('Odie', true), new Cat('Garfield', false)];
            },
          },
        },
      }),
      types: [CatType, DogType],
    });

    const query = `
      {
        pets {
          name
          ... on Dog {
            woofs
          }
          ... on Cat {
            meows
          }
        }
      }
    `;

    expect(await executeQuery({ schema, query })).to.deep.equal({
      data: {
        pets: [
          {
            name: 'Odie',
            woofs: true,
          },
          {
            name: 'Garfield',
            meows: false,
          },
        ],
      },
    });
  });

  it('resolveType can throw', async () => {
    const PetType = new GraphQLInterfaceType({
      name: 'Pet',
      resolveType(_source, context) {
        const error = new Error('We are testing this error');
        if (context.async) {
          return Promise.reject(error);
        }
        throw error;
      },
      fields: {
        name: { type: GraphQLString },
      },
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [PetType],
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      },
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      interfaces: [PetType],
      fields: {
        name: { type: GraphQLString },
        meows: { type: GraphQLBoolean },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          pets: {
            type: new GraphQLList(PetType),
            resolve() {
              return [new Dog('Odie', true), new Cat('Garfield', false)];
            },
          },
        },
      }),
      types: [CatType, DogType],
    });

    const query = `
      {
        pets {
          name
          ... on Dog {
            woofs
          }
          ... on Cat {
            meows
          }
        }
      }
    `;

    expect(await executeQuery({ schema, query })).to.deep.equal({
      data: {
        pets: [null, null],
      },
      errors: [
        {
          message: 'We are testing this error',
          locations: [{ line: 3, column: 9 }],
          path: ['pets', 0],
        },
        {
          message: 'We are testing this error',
          locations: [{ line: 3, column: 9 }],
          path: ['pets', 1],
        },
      ],
    });
  });

  it('resolve Union type using __typename on source object', async () => {
    const schema = buildSchema(`
      type Query {
        pets: [Pet]
      }

      union Pet = Cat | Dog

      type Cat {
        name: String
        meows: Boolean
      }

      type Dog {
        name: String
        woofs: Boolean
      }
    `);

    const query = `
      {
        pets {
          name
          ... on Dog {
            woofs
          }
          ... on Cat {
            meows
          }
        }
      }
    `;

    const rootValue = {
      pets: [
        {
          __typename: 'Dog',
          name: 'Odie',
          woofs: true,
        },
        {
          __typename: 'Cat',
          name: 'Garfield',
          meows: false,
        },
      ],
    };

    expect(await executeQuery({ schema, query, rootValue })).to.deep.equal({
      data: {
        pets: [
          {
            name: 'Odie',
            woofs: true,
          },
          {
            name: 'Garfield',
            meows: false,
          },
        ],
      },
    });
  });

  it('resolve Interface type using __typename on source object', async () => {
    const schema = buildSchema(`
      type Query {
        pets: [Pet]
      }

      interface Pet {
        name: String
        }

      type Cat implements Pet {
        name: String
        meows: Boolean
      }

      type Dog implements Pet {
        name: String
        woofs: Boolean
      }
    `);

    const query = `
      {
        pets {
          name
          ... on Dog {
            woofs
          }
          ... on Cat {
            meows
          }
        }
      }
    `;

    const rootValue = {
      pets: [
        {
          __typename: 'Dog',
          name: 'Odie',
          woofs: true,
        },
        {
          __typename: 'Cat',
          name: 'Garfield',
          meows: false,
        },
      ],
    };

    expect(await executeQuery({ schema, query, rootValue })).to.deep.equal({
      data: {
        pets: [
          {
            name: 'Odie',
            woofs: true,
          },
          {
            name: 'Garfield',
            meows: false,
          },
        ],
      },
    });
  });
});
