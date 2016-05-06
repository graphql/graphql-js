/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { parse } from '../../language';
import { formatError } from '../../error';
import { validate } from '../validate';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLID
} from '../../type';
import {
  GraphQLDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
} from '../../type/directives';


const Being = new GraphQLInterfaceType({
  name: 'Being',
  fields: () => ({
    name: {
      type: GraphQLString,
      args: { surname: { type: GraphQLBoolean } },
    }
  }),
});

const Pet = new GraphQLInterfaceType({
  name: 'Pet',
  fields: () => ({
    name: {
      type: GraphQLString,
      args: { surname: { type: GraphQLBoolean } },
    }
  }),
});

const Canine = new GraphQLInterfaceType({
  name: 'Canine',
  fields: () => ({
    name: {
      type: GraphQLString,
      args: { surname: { type: GraphQLBoolean } },
    }
  }),
});

const DogCommand = new GraphQLEnumType({
  name: 'DogCommand',
  values: {
    SIT: { value: 0 },
    HEEL: { value: 1 },
    DOWN: { value: 2 },
  },
});

const Dog = new GraphQLObjectType({
  name: 'Dog',
  isTypeOf: () => true,
  fields: () => ({
    name: {
      type: GraphQLString,
      args: { surname: { type: GraphQLBoolean } },
    },
    nickname: { type: GraphQLString },
    barkVolume: { type: GraphQLInt },
    barks: { type: GraphQLBoolean },
    doesKnowCommand: {
      type: GraphQLBoolean,
      args: {
        dogCommand: { type: DogCommand },
      },
    },
    isHousetrained: {
      type: GraphQLBoolean,
      args: {
        atOtherHomes: {
          type: GraphQLBoolean,
          defaultValue: true,
        }
      },
    },
    isAtLocation: {
      type: GraphQLBoolean,
      args: { x: { type: GraphQLInt }, y: { type: GraphQLInt } },
    },
  }),
  interfaces: [ Being, Pet, Canine ],
});

const Cat = new GraphQLObjectType({
  name: 'Cat',
  isTypeOf: () => true,
  fields: () => ({
    name: {
      type: GraphQLString,
      args: { surname: { type: GraphQLBoolean } },
    },
    nickname: { type: GraphQLString },
    meows: { type: GraphQLBoolean },
    meowVolume: { type: GraphQLInt },
    furColor: { type: FurColor },
  }),
  interfaces: [ Being, Pet ],
});

const CatOrDog = new GraphQLUnionType({
  name: 'CatOrDog',
  types: [ Dog, Cat ],
  resolveType(/* value */) {
    // not used for validation
  }
});

const Intelligent = new GraphQLInterfaceType({
  name: 'Intelligent',
  fields: {
    iq: { type: GraphQLInt }
  }
});

const Human = new GraphQLObjectType({
  name: 'Human',
  isTypeOf: () => true,
  interfaces: [ Being, Intelligent ],
  fields: () => ({
    name: {
      type: GraphQLString,
      args: { surname: { type: GraphQLBoolean } },
    },
    pets: { type: new GraphQLList(Pet) },
    relatives: { type: new GraphQLList(Human) },
    iq: { type: GraphQLInt },
  })
});

const Alien = new GraphQLObjectType({
  name: 'Alien',
  isTypeOf: () => true,
  interfaces: [ Being, Intelligent ],
  fields: {
    iq: { type: GraphQLInt },
    name: {
      type: GraphQLString,
      args: { surname: { type: GraphQLBoolean } },
    },
    numEyes: { type: GraphQLInt },
  }
});

const DogOrHuman = new GraphQLUnionType({
  name: 'DogOrHuman',
  types: [ Dog, Human ],
  resolveType(/* value */) {
    // not used for validation
  }
});

const HumanOrAlien = new GraphQLUnionType({
  name: 'HumanOrAlien',
  types: [ Human, Alien ],
  resolveType(/* value */) {
    // not used for validation
  }
});

const FurColor = new GraphQLEnumType({
  name: 'FurColor',
  values: {
    BROWN: { value: 0 },
    BLACK: { value: 1 },
    TAN: { value: 2 },
    SPOTTED: { value: 3 },
  },
});

const ComplexInput = new GraphQLInputObjectType({
  name: 'ComplexInput',
  fields: {
    requiredField: { type: new GraphQLNonNull(GraphQLBoolean) },
    intField: { type: GraphQLInt },
    stringField: { type: GraphQLString },
    booleanField: { type: GraphQLBoolean },
    stringListField: { type: new GraphQLList(GraphQLString) },
  }
});

const ComplicatedArgs = new GraphQLObjectType({
  name: 'ComplicatedArgs',
  // TODO List
  // TODO Coercion
  // TODO NotNulls
  fields: () => ({
    intArgField: {
      type: GraphQLString,
      args: { intArg: { type: GraphQLInt } },
    },
    nonNullIntArgField: {
      type: GraphQLString,
      args: { nonNullIntArg: { type: new GraphQLNonNull(GraphQLInt) } },
    },
    stringArgField: {
      type: GraphQLString,
      args: { stringArg: { type: GraphQLString } },
    },
    booleanArgField: {
      type: GraphQLString,
      args: { booleanArg: { type: GraphQLBoolean } },
    },
    enumArgField: {
      type: GraphQLString,
      args: { enumArg: { type: FurColor } },
    },
    floatArgField: {
      type: GraphQLString,
      args: { floatArg: { type: GraphQLFloat } },
    },
    idArgField: {
      type: GraphQLString,
      args: { idArg: { type: GraphQLID } },
    },
    stringListArgField: {
      type: GraphQLString,
      args: { stringListArg: { type: new GraphQLList(GraphQLString) } },
    },
    complexArgField: {
      type: GraphQLString,
      args: { complexArg: { type: ComplexInput } },
    },
    multipleReqs: {
      type: GraphQLString,
      args: {
        req1: { type: new GraphQLNonNull(GraphQLInt) },
        req2: { type: new GraphQLNonNull(GraphQLInt) },
      },
    },
    multipleOpts: {
      type: GraphQLString,
      args: {
        opt1: {
          type: GraphQLInt,
          defaultValue: 0,
        },
        opt2: {
          type: GraphQLInt,
          defaultValue: 0,
        },
      },
    },
    multipleOptAndReq: {
      type: GraphQLString,
      args: {
        req1: { type: new GraphQLNonNull(GraphQLInt) },
        req2: { type: new GraphQLNonNull(GraphQLInt) },
        opt1: {
          type: GraphQLInt,
          defaultValue: 0,
        },
        opt2: {
          type: GraphQLInt,
          defaultValue: 0,
        },
      },
    },
  }),
});


const QueryRoot = new GraphQLObjectType({
  name: 'QueryRoot',
  fields: () => ({
    human: {
      args: { id: { type: GraphQLID } },
      type: Human
    },
    alien: { type: Alien },
    dog: { type: Dog },
    cat: { type: Cat },
    pet: { type: Pet },
    catOrDog: { type: CatOrDog },
    dogOrHuman: { type: DogOrHuman },
    humanOrAlien: { type: HumanOrAlien },
    complicatedArgs: { type: ComplicatedArgs },
  })
});

export const testSchema = new GraphQLSchema({
  query: QueryRoot,
  types: [ Cat, Dog, Human, Alien ],
  directives: [
    GraphQLIncludeDirective,
    GraphQLSkipDirective,
    new GraphQLDirective({
      name: 'onQuery',
      locations: [ 'QUERY' ],
    }),
    new GraphQLDirective({
      name: 'onMutation',
      locations: [ 'MUTATION' ],
    }),
    new GraphQLDirective({
      name: 'onSubscription',
      locations: [ 'SUBSCRIPTION' ],
    }),
    new GraphQLDirective({
      name: 'onField',
      locations: [ 'FIELD' ],
    }),
    new GraphQLDirective({
      name: 'onFragmentDefinition',
      locations: [ 'FRAGMENT_DEFINITION' ],
    }),
    new GraphQLDirective({
      name: 'onFragmentSpread',
      locations: [ 'FRAGMENT_SPREAD' ],
    }),
    new GraphQLDirective({
      name: 'onInlineFragment',
      locations: [ 'INLINE_FRAGMENT' ],
    }),
    new GraphQLDirective({
      name: 'onSchema',
      locations: [ 'SCHEMA' ],
    }),
    new GraphQLDirective({
      name: 'onScalar',
      locations: [ 'SCALAR' ],
    }),
    new GraphQLDirective({
      name: 'onObject',
      locations: [ 'OBJECT' ],
    }),
    new GraphQLDirective({
      name: 'onFieldDefinition',
      locations: [ 'FIELD_DEFINITION' ],
    }),
    new GraphQLDirective({
      name: 'onArgumentDefinition',
      locations: [ 'ARGUMENT_DEFINITION' ],
    }),
    new GraphQLDirective({
      name: 'onInterface',
      locations: [ 'INTERFACE' ],
    }),
    new GraphQLDirective({
      name: 'onUnion',
      locations: [ 'UNION' ],
    }),
    new GraphQLDirective({
      name: 'onEnum',
      locations: [ 'ENUM' ],
    }),
    new GraphQLDirective({
      name: 'onEnumValue',
      locations: [ 'ENUM_VALUE' ],
    }),
    new GraphQLDirective({
      name: 'onInputObject',
      locations: [ 'INPUT_OBJECT' ],
    }),
    new GraphQLDirective({
      name: 'onInputFieldDefinition',
      locations: [ 'INPUT_FIELD_DEFINITION' ],
    }),
  ]
});

function expectValid(schema, rules, queryString) {
  const errors = validate(schema, parse(queryString), rules);
  expect(errors).to.deep.equal([], 'Should validate');
}

function expectInvalid(schema, rules, queryString, expectedErrors) {
  const errors = validate(schema, parse(queryString), rules);
  expect(errors).to.have.length.of.at.least(1, 'Should not validate');
  expect(errors.map(formatError)).to.deep.equal(expectedErrors);
}

export function expectPassesRule(rule, queryString) {
  return expectValid(testSchema, [ rule ], queryString);
}

export function expectFailsRule(rule, queryString, errors) {
  return expectInvalid(testSchema, [ rule ], queryString, errors);
}

export function expectPassesRuleWithSchema(schema, rule, queryString, errors) {
  return expectValid(schema, [ rule ], queryString, errors);
}

export function expectFailsRuleWithSchema(schema, rule, queryString, errors) {
  return expectInvalid(schema, [ rule ], queryString, errors);
}
