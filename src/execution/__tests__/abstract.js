/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
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
  constructor(name, woofs) {
    this.name = name;
    this.woofs = woofs;
  }
}

class Cat {
  constructor(name, meows) {
    this.name = name;
    this.meows = meows;
  }
}

class Human {
  constructor(name) {
    this.name = name;
  }
}

describe('Execute: Handles execution of abstract types', () => {

  it('isTypeOf used to resolve runtime type for Interface', async () => {
    const PetType = new GraphQLInterfaceType({
      name: 'Pet',
      fields: {
        name: { type: GraphQLString }
      }
    });

    // Added to interface type when defined
    /* eslint-disable no-unused-vars */

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [ PetType ],
      isTypeOf: obj => obj instanceof Dog,
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      }
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      interfaces: [ PetType ],
      isTypeOf: obj => obj instanceof Cat,
      fields: {
        name: { type: GraphQLString },
        meows: { type: GraphQLBoolean },
      }
    });

    /* eslint-enable no-unused-vars */

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          pets: {
            type: new GraphQLList(PetType),
            resolve() {
              return [ new Dog('Odie', true), new Cat('Garfield', false) ];
            }
          }
        }
      })
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
          { name: 'Odie',
            woofs: true },
          { name: 'Garfield',
            meows: false } ] }
    });
  });

  it('isTypeOf used to resolve runtime type for Union', async () => {
    const DogType = new GraphQLObjectType({
      name: 'Dog',
      isTypeOf: obj => obj instanceof Dog,
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      }
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      isTypeOf: obj => obj instanceof Cat,
      fields: {
        name: { type: GraphQLString },
        meows: { type: GraphQLBoolean },
      }
    });

    const PetType = new GraphQLUnionType({
      name: 'Pet',
      types: [ DogType, CatType ]
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          pets: {
            type: new GraphQLList(PetType),
            resolve() {
              return [ new Dog('Odie', true), new Cat('Garfield', false) ];
            }
          }
        }
      })
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
          { name: 'Odie',
            woofs: true },
          { name: 'Garfield',
            meows: false } ] }
    });
  });

  it('resolveType on Interface yields useful error', async () => {
    const PetType = new GraphQLInterfaceType({
      name: 'Pet',
      resolveType(obj) {
        return obj instanceof Dog ? DogType :
          obj instanceof Cat ? CatType :
          obj instanceof Human ? HumanType :
          null;
      },
      fields: {
        name: { type: GraphQLString }
      }
    });

    const HumanType = new GraphQLObjectType({
      name: 'Human',
      fields: {
        name: { type: GraphQLString },
      }
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [ PetType ],
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      }
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      interfaces: [ PetType ],
      fields: {
        name: { type: GraphQLString },
        meows: { type: GraphQLBoolean },
      }
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
                new Human('Jon')
              ];
            }
          }
        }
      })
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
          { name: 'Odie',
            woofs: true },
          { name: 'Garfield',
            meows: false },
          null
        ]
      },
      errors: [
        { message:
            'Runtime Object type "Human" is not a possible type for "Pet".' }
      ]
    });
  });

  it('resolveType on Union yields useful error', async () => {
    const HumanType = new GraphQLObjectType({
      name: 'Human',
      fields: {
        name: { type: GraphQLString },
      }
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      fields: {
        name: { type: GraphQLString },
        woofs: { type: GraphQLBoolean },
      }
    });

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      fields: {
        name: { type: GraphQLString },
        meows: { type: GraphQLBoolean },
      }
    });

    const PetType = new GraphQLUnionType({
      name: 'Pet',
      resolveType(obj) {
        return obj instanceof Dog ? DogType :
          obj instanceof Cat ? CatType :
          obj instanceof Human ? HumanType :
          null;
      },
      types: [ DogType, CatType ]
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
                new Human('Jon')
              ];
            }
          }
        }
      })
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
          { name: 'Odie',
            woofs: true },
          { name: 'Garfield',
            meows: false },
          null
        ]
      },
      errors: [
        { message:
            'Runtime Object type "Human" is not a possible type for "Pet".' }
      ]
    });
  });

});
