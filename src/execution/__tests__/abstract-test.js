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

import { executeSync } from '../execute';

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
  it('isTypeOf used to resolve runtime type for Interface', () => {
    const PetType = new GraphQLInterfaceType({
      name: 'Pet',
      fields: {
        name: { type: GraphQLString },
      },
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [PetType],
      isTypeOf: (obj) => obj instanceof Dog,
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      },
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      interfaces: [PetType],
      isTypeOf: (obj) => obj instanceof Cat,
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
            type: GraphQLList(PetType),
            resolve() {
              return [new Dog('Odie', true), new Cat('Garfield', false)];
            },
          },
        },
      }),
      types: [CatType, DogType],
    });

    const document = parse(`
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
    `);

    expect(executeSync({ schema, document })).to.deep.equal({
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

  it('isTypeOf used to resolve runtime type for Union', () => {
    const DogType = new GraphQLObjectType({
      name: 'Dog',
      isTypeOf: (obj) => obj instanceof Dog,
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      },
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      isTypeOf: (obj) => obj instanceof Cat,
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
            type: GraphQLList(PetType),
            resolve() {
              return [new Dog('Odie', true), new Cat('Garfield', false)];
            },
          },
        },
      }),
    });

    const document = parse(`{
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
    }`);

    expect(executeSync({ schema, document })).to.deep.equal({
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

  it('resolveType on Interface yields useful error', () => {
    const PetType = new GraphQLInterfaceType({
      name: 'Pet',
      resolveType(obj) {
        if (obj instanceof Dog) {
          return DogType;
        }
        if (obj instanceof Cat) {
          return CatType;
        }
        // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')
        if (obj instanceof Human) {
          return HumanType;
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
            type: GraphQLList(PetType),
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

    const document = parse(`
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
    `);

    const result = executeSync({ schema, document });

    expect(result).to.deep.equal({
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

  it('resolveType on Union yields useful error', () => {
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
      resolveType(obj) {
        if (obj instanceof Dog) {
          return DogType;
        }
        if (obj instanceof Cat) {
          return CatType;
        }
        // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')
        if (obj instanceof Human) {
          return HumanType;
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
            type: GraphQLList(PetType),
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

    const document = parse(`
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
    `);

    const result = executeSync({ schema, document });

    expect(result).to.deep.equal({
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

  it('returning invalid value from resolveType yields useful error', () => {
    const fooInterface = new GraphQLInterfaceType({
      name: 'FooInterface',
      fields: { bar: { type: GraphQLString } },
      // $FlowExpectedError
      resolveType() {
        return [];
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

    const document = parse('{ foo { bar } }');

    expect(executeSync({ schema, document })).to.deep.equal({
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

  it('missing both resolveType and isTypeOf yields useful error', () => {
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

    const document = parse('{ foo { bar } }');

    expect(executeSync({ schema, document })).to.deep.equal({
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

  it('resolveType allows resolving with type name', () => {
    const PetType = new GraphQLInterfaceType({
      name: 'Pet',
      resolveType(obj) {
        if (obj instanceof Dog) {
          return 'Dog';
        }
        // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')
        if (obj instanceof Cat) {
          return 'Cat';
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
            type: GraphQLList(PetType),
            resolve() {
              return [new Dog('Odie', true), new Cat('Garfield', false)];
            },
          },
        },
      }),
      types: [CatType, DogType],
    });

    const document = parse(`
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
    `);

    expect(executeSync({ schema, document })).to.deep.equal({
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
