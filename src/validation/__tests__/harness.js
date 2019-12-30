// @flow strict

import { expect } from 'chai';

import inspect from '../../jsutils/inspect';

import { parse } from '../../language/parser';

import { GraphQLSchema } from '../../type/schema';
import {
  GraphQLDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLDeferDirective,
} from '../../type/directives';
import {
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLID,
} from '../../type/scalars';
import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from '../../type/definition';

import { validate, validateSDL } from '../validate';
import {
  type ValidationRule,
  type SDLValidationRule,
} from '../ValidationContext';

const Being = new GraphQLInterfaceType({
  name: 'Being',
  fields: () => ({
    name: {
      type: GraphQLString,
      args: { surname: { type: GraphQLBoolean } },
    },
  }),
});

const Mammal = new GraphQLInterfaceType({
  name: 'Mammal',
  interfaces: [],
  fields: () => ({
    mother: {
      type: Mammal,
    },
    father: {
      type: Mammal,
    },
  }),
});

const Pet = new GraphQLInterfaceType({
  name: 'Pet',
  interfaces: [Being],
  fields: () => ({
    name: {
      type: GraphQLString,
      args: { surname: { type: GraphQLBoolean } },
    },
  }),
});

const Canine = new GraphQLInterfaceType({
  name: 'Canine',
  interfaces: [Mammal, Being],
  fields: () => ({
    name: {
      type: GraphQLString,
      args: { surname: { type: GraphQLBoolean } },
    },
    mother: {
      type: Canine,
    },
    father: {
      type: Canine,
    },
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
  interfaces: [Being, Pet, Mammal, Canine],
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
    isHouseTrained: {
      type: GraphQLBoolean,
      args: {
        atOtherHomes: {
          type: GraphQLBoolean,
          defaultValue: true,
        },
      },
    },
    isAtLocation: {
      type: GraphQLBoolean,
      args: { x: { type: GraphQLInt }, y: { type: GraphQLInt } },
    },
    mother: {
      type: Dog,
    },
    father: {
      type: Dog,
    },
  }),
});

const Cat = new GraphQLObjectType({
  name: 'Cat',
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
  interfaces: [Being, Pet],
});

const CatOrDog = new GraphQLUnionType({
  name: 'CatOrDog',
  types: [Dog, Cat],
});

const Intelligent = new GraphQLInterfaceType({
  name: 'Intelligent',
  fields: {
    iq: { type: GraphQLInt },
  },
});

const Human = new GraphQLObjectType({
  name: 'Human',
  interfaces: [Being, Intelligent],
  fields: () => ({
    name: {
      type: GraphQLString,
      args: { surname: { type: GraphQLBoolean } },
    },
    pets: { type: GraphQLList(Pet) },
    relatives: { type: GraphQLList(Human) },
    iq: { type: GraphQLInt },
  }),
});

const Alien = new GraphQLObjectType({
  name: 'Alien',
  interfaces: [Being, Intelligent],
  fields: {
    iq: { type: GraphQLInt },
    name: {
      type: GraphQLString,
      args: { surname: { type: GraphQLBoolean } },
    },
    numEyes: { type: GraphQLInt },
  },
});

const DogOrHuman = new GraphQLUnionType({
  name: 'DogOrHuman',
  types: [Dog, Human],
});

const HumanOrAlien = new GraphQLUnionType({
  name: 'HumanOrAlien',
  types: [Human, Alien],
});

const FurColor = new GraphQLEnumType({
  name: 'FurColor',
  values: {
    BROWN: { value: 0 },
    BLACK: { value: 1 },
    TAN: { value: 2 },
    SPOTTED: { value: 3 },
    NO_FUR: { value: null },
    UNKNOWN: { value: undefined },
  },
});

const ComplexInput = new GraphQLInputObjectType({
  name: 'ComplexInput',
  fields: {
    requiredField: { type: GraphQLNonNull(GraphQLBoolean) },
    nonNullField: { type: GraphQLNonNull(GraphQLBoolean), defaultValue: false },
    intField: { type: GraphQLInt },
    stringField: { type: GraphQLString },
    booleanField: { type: GraphQLBoolean },
    stringListField: { type: GraphQLList(GraphQLString) },
  },
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
      args: { nonNullIntArg: { type: GraphQLNonNull(GraphQLInt) } },
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
      args: { stringListArg: { type: GraphQLList(GraphQLString) } },
    },
    stringListNonNullArgField: {
      type: GraphQLString,
      args: {
        stringListNonNullArg: {
          type: GraphQLList(GraphQLNonNull(GraphQLString)),
        },
      },
    },
    complexArgField: {
      type: GraphQLString,
      args: { complexArg: { type: ComplexInput } },
    },
    multipleReqs: {
      type: GraphQLString,
      args: {
        req1: { type: GraphQLNonNull(GraphQLInt) },
        req2: { type: GraphQLNonNull(GraphQLInt) },
      },
    },
    nonNullFieldWithDefault: {
      type: GraphQLString,
      args: {
        arg: { type: GraphQLNonNull(GraphQLInt), defaultValue: 0 },
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
        req1: { type: GraphQLNonNull(GraphQLInt) },
        req2: { type: GraphQLNonNull(GraphQLInt) },
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

const InvalidScalar = new GraphQLScalarType({
  name: 'Invalid',
  parseValue(value) {
    throw new Error(`Invalid scalar is always invalid: ${inspect(value)}`);
  },
});

const AnyScalar = new GraphQLScalarType({ name: 'Any' });

const QueryRoot = new GraphQLObjectType({
  name: 'QueryRoot',
  fields: () => ({
    human: {
      args: { id: { type: GraphQLID } },
      type: Human,
    },
    alien: { type: Alien },
    dog: { type: Dog },
    cat: { type: Cat },
    pet: { type: Pet },
    catOrDog: { type: CatOrDog },
    dogOrHuman: { type: DogOrHuman },
    humanOrAlien: { type: HumanOrAlien },
    complicatedArgs: { type: ComplicatedArgs },
    invalidArg: {
      args: {
        arg: { type: InvalidScalar },
      },
      type: GraphQLString,
    },
    anyArg: {
      args: {
        arg: { type: AnyScalar },
      },
      type: GraphQLString,
    },
  }),
});

export const testSchema = new GraphQLSchema({
  query: QueryRoot,
  types: [Cat, Dog, Human, Alien],
  directives: [
    GraphQLIncludeDirective,
    GraphQLSkipDirective,
    GraphQLDeferDirective,
    new GraphQLDirective({
      name: 'onQuery',
      locations: ['QUERY'],
    }),
    new GraphQLDirective({
      name: 'onMutation',
      locations: ['MUTATION'],
    }),
    new GraphQLDirective({
      name: 'onSubscription',
      locations: ['SUBSCRIPTION'],
    }),
    new GraphQLDirective({
      name: 'onField',
      locations: ['FIELD'],
    }),
    new GraphQLDirective({
      name: 'onFragmentDefinition',
      locations: ['FRAGMENT_DEFINITION'],
    }),
    new GraphQLDirective({
      name: 'onFragmentSpread',
      locations: ['FRAGMENT_SPREAD'],
    }),
    new GraphQLDirective({
      name: 'onInlineFragment',
      locations: ['INLINE_FRAGMENT'],
    }),
    new GraphQLDirective({
      name: 'onVariableDefinition',
      locations: ['VARIABLE_DEFINITION'],
    }),
  ],
});

export function expectValidationErrorsWithSchema(
  schema: GraphQLSchema,
  rule: ValidationRule,
  queryStr: string,
) {
  const doc = parse(queryStr);
  const errors = validate(schema, doc, [rule]);
  return expect(errors);
}

export function expectValidationErrors(rule: ValidationRule, queryStr: string) {
  return expectValidationErrorsWithSchema(testSchema, rule, queryStr);
}

export function expectSDLValidationErrors(
  schema: ?GraphQLSchema,
  rule: SDLValidationRule,
  sdlStr: string,
) {
  const doc = parse(sdlStr);
  const errors = validateSDL(doc, schema, [rule]);
  return expect(errors);
}
