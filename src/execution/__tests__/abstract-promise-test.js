/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLList,
  GraphQLString,
  GraphQLBoolean,
} from '../../';

class Dog {
  name: string;
  woofs: boolean;

  constructor(name, woofs) {
    this.name = name;
    this.woofs = woofs;
  }
}

class Cat {
  name: string;
  meows: boolean;

  constructor(name, meows) {
    this.name = name;
    this.meows = meows;
  }
}

class Human {
  name: string;

  constructor(name) {
    this.name = name;
  }
}

describe('Execute: Handles execution of abstract types with promises', () => {
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
      isTypeOf: obj => Promise.resolve(obj instanceof Dog),
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      },
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      interfaces: [PetType],
      isTypeOf: obj => Promise.resolve(obj instanceof Cat),
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

    const query = `{
      pets {
        name
        ... on Dog {
          woofs
        }
        ... on Cat {
          meows
        }
      }
    }`;

    const result = await graphql(schema, query);

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
        ],
      },
    });
  });

  it('isTypeOf can be rejected', async () => {
    const PetType = new GraphQLInterfaceType({
      name: 'Pet',
      fields: {
        name: { type: GraphQLString },
      },
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [PetType],
      isTypeOf: () => Promise.reject(new Error('We are testing this error')),
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      },
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      interfaces: [PetType],
      isTypeOf: obj => Promise.resolve(obj instanceof Cat),
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

    const query = `{
      pets {
        name
        ... on Dog {
          woofs
        }
        ... on Cat {
          meows
        }
      }
    }`;

    const result = await graphql(schema, query);

    expect(result).to.deep.equal({
      data: {
        pets: [null, null],
      },
      errors: [
        {
          message: 'We are testing this error',
          locations: [{ line: 2, column: 7 }],
          path: ['pets', 0],
        },
        {
          message: 'We are testing this error',
          locations: [{ line: 2, column: 7 }],
          path: ['pets', 1],
        },
      ],
    });
  });

  it('isTypeOf used to resolve runtime type for Union', async () => {
    const DogType = new GraphQLObjectType({
      name: 'Dog',
      isTypeOf: obj => Promise.resolve(obj instanceof Dog),
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      },
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      isTypeOf: obj => Promise.resolve(obj instanceof Cat),
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

    const result = await graphql(schema, query);

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
        ],
      },
    });
  });

  it('resolveType on Interface yields useful error', async () => {
    const PetType = new GraphQLInterfaceType({
      name: 'Pet',
      resolveType(obj) {
        return Promise.resolve(
          obj instanceof Dog
            ? DogType
            : obj instanceof Cat
            ? CatType
            : obj instanceof Human
            ? HumanType
            : null,
        );
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
              return Promise.resolve([
                new Dog('Odie', true),
                new Cat('Garfield', false),
                new Human('Jon'),
              ]);
            },
          },
        },
      }),
      types: [CatType, DogType],
    });

    const query = `{
      pets {
        name
        ... on Dog {
          woofs
        }
        ... on Cat {
          meows
        }
      }
    }`;

    const result = await graphql(schema, query);

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
          locations: [{ line: 2, column: 7 }],
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
      resolveType(obj) {
        return Promise.resolve(
          obj instanceof Dog
            ? DogType
            : obj instanceof Cat
            ? CatType
            : obj instanceof Human
            ? HumanType
            : null,
        );
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

    const result = await graphql(schema, query);

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
          locations: [{ line: 2, column: 7 }],
          path: ['pets', 2],
        },
      ],
    });
  });

  it('resolveType allows resolving with type name', async () => {
    const PetType = new GraphQLInterfaceType({
      name: 'Pet',
      resolveType(obj) {
        return Promise.resolve(
          obj instanceof Dog ? 'Dog' : obj instanceof Cat ? 'Cat' : null,
        );
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

    const query = `{
      pets {
        name
        ... on Dog {
          woofs
        }
        ... on Cat {
          meows
        }
      }
    }`;

    const result = await graphql(schema, query);

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
        ],
      },
    });
  });

  it('resolveType can be caught', async () => {
    const PetType = new GraphQLInterfaceType({
      name: 'Pet',
      resolveType: () => Promise.reject(new Error('We are testing this error')),
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

    const query = `{
      pets {
        name
        ... on Dog {
          woofs
        }
        ... on Cat {
          meows
        }
      }
    }`;

    const result = await graphql(schema, query);

    expect(result).to.deep.equal({
      data: {
        pets: [null, null],
      },
      errors: [
        {
          message: 'We are testing this error',
          locations: [{ line: 2, column: 7 }],
          path: ['pets', 0],
        },
        {
          message: 'We are testing this error',
          locations: [{ line: 2, column: 7 }],
          path: ['pets', 1],
        },
      ],
    });
  });
});
