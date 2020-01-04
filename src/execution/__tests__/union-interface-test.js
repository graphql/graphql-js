// @flow strict

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

import { execute } from '../execute';

class Dog {
  name: string;
  barks: boolean;
  mother: ?Dog;
  father: ?Dog;
  progeny: Array<Dog>;

  constructor(name, barks) {
    this.name = name;
    this.barks = barks;
    this.mother = null;
    this.father = null;
    this.progeny = [];
  }
}

class Cat {
  name: string;
  meows: boolean;
  mother: ?Cat;
  father: ?Cat;
  progeny: Array<Cat>;

  constructor(name, meows) {
    this.name = name;
    this.meows = meows;
    this.mother = null;
    this.father = null;
    this.progeny = [];
  }
}

class Person {
  name: string;
  pets: ?Array<Dog | Cat>;
  friends: ?Array<Dog | Cat | Person>;

  constructor(name, pets, friends) {
    this.name = name;
    this.pets = pets;
    this.friends = friends;
  }
}

const NamedType = new GraphQLInterfaceType({
  name: 'Named',
  fields: {
    name: { type: GraphQLString },
  },
});

const LifeType = new GraphQLInterfaceType({
  name: 'Life',
  fields: () => ({
    progeny: { type: GraphQLList(LifeType) },
  }),
});

const MammalType = new GraphQLInterfaceType({
  name: 'Mammal',
  interfaces: [LifeType],
  fields: () => ({
    progeny: { type: GraphQLList(MammalType) },
    mother: { type: MammalType },
    father: { type: MammalType },
  }),
});

const DogType = new GraphQLObjectType({
  name: 'Dog',
  interfaces: [MammalType, LifeType, NamedType],
  fields: () => ({
    name: { type: GraphQLString },
    barks: { type: GraphQLBoolean },
    progeny: { type: GraphQLList(DogType) },
    mother: { type: DogType },
    father: { type: DogType },
  }),
  isTypeOf: value => value instanceof Dog,
});

const CatType = new GraphQLObjectType({
  name: 'Cat',
  interfaces: [MammalType, LifeType, NamedType],
  fields: () => ({
    name: { type: GraphQLString },
    meows: { type: GraphQLBoolean },
    progeny: { type: GraphQLList(CatType) },
    mother: { type: CatType },
    father: { type: CatType },
  }),
  isTypeOf: value => value instanceof Cat,
});

const PetType = new GraphQLUnionType({
  name: 'Pet',
  types: [DogType, CatType],
  resolveType(value) {
    if (value instanceof Dog) {
      return DogType;
    }
    if (value instanceof Cat) {
      return CatType;
    }

    // Not reachable. All possible types have been considered.
    invariant(false);
  },
});

const PersonType = new GraphQLObjectType({
  name: 'Person',
  interfaces: [NamedType, MammalType, LifeType],
  fields: () => ({
    name: { type: GraphQLString },
    pets: { type: GraphQLList(PetType) },
    friends: { type: GraphQLList(NamedType) },
    progeny: { type: GraphQLList(PersonType) },
    mother: { type: PersonType },
    father: { type: PersonType },
  }),
  isTypeOf: value => value instanceof Person,
});

const schema = new GraphQLSchema({
  query: PersonType,
  types: [PetType],
});

const garfield = new Cat('Garfield', false);
garfield.mother = new Cat("Garfield's Mom", false);
garfield.mother.progeny = [garfield];

const odie = new Dog('Odie', true);
odie.mother = new Dog("Odie's Mom", true);
odie.mother.progeny = [odie];

const liz = new Person('Liz');
const john = new Person('John', [garfield, odie], [liz, odie]);

describe('Execute: Union and intersection types', () => {
  it('can introspect on union and intersection types', () => {
    const document = parse(`
      {
        Named: __type(name: "Named") {
          kind
          name
          fields { name }
          interfaces { name }
          possibleTypes { name }
          enumValues { name }
          inputFields { name }
        }
        Mammal: __type(name: "Mammal") {
          kind
          name
          fields { name }
          interfaces { name }
          possibleTypes { name }
          enumValues { name }
          inputFields { name }
        }
        Pet: __type(name: "Pet") {
          kind
          name
          fields { name }
          interfaces { name }
          possibleTypes { name }
          enumValues { name }
          inputFields { name }
        }
      }
    `);

    expect(execute({ schema, document })).to.deep.equal({
      data: {
        Named: {
          kind: 'INTERFACE',
          name: 'Named',
          fields: [{ name: 'name' }],
          interfaces: [],
          possibleTypes: [{ name: 'Person' }, { name: 'Dog' }, { name: 'Cat' }],
          enumValues: null,
          inputFields: null,
        },
        Mammal: {
          kind: 'INTERFACE',
          name: 'Mammal',
          fields: [{ name: 'progeny' }, { name: 'mother' }, { name: 'father' }],
          interfaces: [{ name: 'Life' }],
          possibleTypes: [{ name: 'Person' }, { name: 'Dog' }, { name: 'Cat' }],
          enumValues: null,
          inputFields: null,
        },
        Pet: {
          kind: 'UNION',
          name: 'Pet',
          fields: null,
          interfaces: null,
          possibleTypes: [{ name: 'Dog' }, { name: 'Cat' }],
          enumValues: null,
          inputFields: null,
        },
      },
    });
  });

  it('executes using union types', () => {
    // NOTE: This is an *invalid* query, but it should be an *executable* query.
    const document = parse(`
      {
        __typename
        name
        pets {
          __typename
          name
          barks
          meows
        }
      }
    `);

    expect(execute({ schema, document, rootValue: john })).to.deep.equal({
      data: {
        __typename: 'Person',
        name: 'John',
        pets: [
          {
            __typename: 'Cat',
            name: 'Garfield',
            meows: false,
          },
          {
            __typename: 'Dog',
            name: 'Odie',
            barks: true,
          },
        ],
      },
    });
  });

  it('executes union types with inline fragments', () => {
    // This is the valid version of the query in the above test.
    const document = parse(`
      {
        __typename
        name
        pets {
          __typename
          ... on Dog {
            name
            barks
          }
          ... on Cat {
            name
            meows
          }
        }
      }
    `);

    expect(execute({ schema, document, rootValue: john })).to.deep.equal({
      data: {
        __typename: 'Person',
        name: 'John',
        pets: [
          {
            __typename: 'Cat',
            name: 'Garfield',
            meows: false,
          },
          {
            __typename: 'Dog',
            name: 'Odie',
            barks: true,
          },
        ],
      },
    });
  });

  it('executes using interface types', () => {
    // NOTE: This is an *invalid* query, but it should be an *executable* query.
    const document = parse(`
      {
        __typename
        name
        friends {
          __typename
          name
          barks
          meows
        }
      }
    `);

    expect(execute({ schema, document, rootValue: john })).to.deep.equal({
      data: {
        __typename: 'Person',
        name: 'John',
        friends: [
          { __typename: 'Person', name: 'Liz' },
          { __typename: 'Dog', name: 'Odie', barks: true },
        ],
      },
    });
  });

  it('executes interface types with inline fragments', () => {
    // This is the valid version of the query in the above test.
    const document = parse(`
      {
        __typename
        name
        friends {
          __typename
          name
          ... on Dog {
            barks
          }
          ... on Cat {
            meows
          }

          ... on Mammal {
            mother {
              __typename
              ... on Dog {
                name
                barks
              }
              ... on Cat {
                name
                meows
              }
            }
          }
        }
      }
    `);

    expect(execute({ schema, document, rootValue: john })).to.deep.equal({
      data: {
        __typename: 'Person',
        name: 'John',
        friends: [
          {
            __typename: 'Person',
            name: 'Liz',
            mother: null,
          },
          {
            __typename: 'Dog',
            name: 'Odie',
            barks: true,
            mother: { __typename: 'Dog', name: "Odie's Mom", barks: true },
          },
        ],
      },
    });
  });

  it('allows fragment conditions to be abstract types', () => {
    const document = parse(`
      {
        __typename
        name
        pets {
          ...PetFields,
          ...on Mammal {
            mother {
              ...ProgenyFields
            }
          }
        }
        friends { ...FriendFields }
      }

      fragment PetFields on Pet {
        __typename
        ... on Dog {
          name
          barks
        }
        ... on Cat {
          name
          meows
        }
      }

      fragment FriendFields on Named {
        __typename
        name
        ... on Dog {
          barks
        }
        ... on Cat {
          meows
        }
      }

      fragment ProgenyFields on Life {
        progeny {
          __typename
        }
      }
    `);

    expect(execute({ schema, document, rootValue: john })).to.deep.equal({
      data: {
        __typename: 'Person',
        name: 'John',
        pets: [
          {
            __typename: 'Cat',
            name: 'Garfield',
            meows: false,
            mother: { progeny: [{ __typename: 'Cat' }] },
          },
          {
            __typename: 'Dog',
            name: 'Odie',
            barks: true,
            mother: { progeny: [{ __typename: 'Dog' }] },
          },
        ],
        friends: [
          {
            __typename: 'Person',
            name: 'Liz',
          },
          {
            __typename: 'Dog',
            name: 'Odie',
            barks: true,
          },
        ],
      },
    });
  });

  it('gets execution info in resolver', () => {
    let encounteredContext;
    let encounteredSchema;
    let encounteredRootValue;

    const NamedType2 = new GraphQLInterfaceType({
      name: 'Named',
      fields: {
        name: { type: GraphQLString },
      },
      resolveType(_source, context, info) {
        encounteredContext = context;
        encounteredSchema = info.schema;
        encounteredRootValue = info.rootValue;
        return PersonType2;
      },
    });

    const PersonType2 = new GraphQLObjectType({
      name: 'Person',
      interfaces: [NamedType2],
      fields: {
        name: { type: GraphQLString },
        friends: { type: GraphQLList(NamedType2) },
      },
    });
    const schema2 = new GraphQLSchema({ query: PersonType2 });
    const document = parse('{ name, friends { name } }');
    const rootValue = new Person('John', [], [liz]);
    const contextValue = { authToken: '123abc' };

    const result = execute({
      schema: schema2,
      document,
      rootValue,
      contextValue,
    });
    expect(result).to.deep.equal({
      data: {
        name: 'John',
        friends: [{ name: 'Liz' }],
      },
    });

    expect(encounteredSchema).to.equal(schema2);
    expect(encounteredRootValue).to.equal(rootValue);
    expect(encounteredContext).to.equal(contextValue);
  });
});
