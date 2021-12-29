import { expectJSON } from '../../__testUtils__/expectJSON';

import type { Maybe } from '../../jsutils/Maybe';

import { parse } from '../../language/parser';

import type { GraphQLSchema } from '../../type/schema';

import { buildSchema } from '../../utilities/buildASTSchema';

import { validate, validateSDL } from '../validate';
import type { SDLValidationRule, ValidationRule } from '../ValidationContext';

export const testSchema: GraphQLSchema = buildSchema(`
  interface Mammal {
    mother: Mammal
    father: Mammal
  }

  interface Pet {
    name(surname: Boolean): String
  }

  interface Canine implements Mammal {
    name(surname: Boolean): String
    mother: Canine
    father: Canine
  }

  enum DogCommand {
    SIT
    HEEL
    DOWN
  }

  type Dog implements Pet & Mammal & Canine {
    name(surname: Boolean): String
    nickname: String
    barkVolume: Int
    barks: Boolean
    doesKnowCommand(dogCommand: DogCommand): Boolean
    isHouseTrained(atOtherHomes: Boolean = true): Boolean
    isAtLocation(x: Int, y: Int): Boolean
    mother: Dog
    father: Dog
  }

  type Cat implements Pet {
    name(surname: Boolean): String
    nickname: String
    meows: Boolean
    meowsVolume: Int
    furColor: FurColor
  }

  union CatOrDog = Cat | Dog

  type Human {
    name(surname: Boolean): String
    pets: [Pet]
    relatives: [Human]
  }

  enum FurColor {
    BROWN
    BLACK
    TAN
    SPOTTED
    NO_FUR
    UNKNOWN
  }

  input ComplexInput {
    requiredField: Boolean!
    nonNullField: Boolean! = false
    intField: Int
    stringField: String
    booleanField: Boolean
    stringListField: [String]
  }

  type ComplicatedArgs {
    # TODO List
    # TODO Coercion
    # TODO NotNulls
    intArgField(intArg: Int): String
    nonNullIntArgField(nonNullIntArg: Int!): String
    stringArgField(stringArg: String): String
    booleanArgField(booleanArg: Boolean): String
    enumArgField(enumArg: FurColor): String
    floatArgField(floatArg: Float): String
    idArgField(idArg: ID): String
    stringListArgField(stringListArg: [String]): String
    stringListNonNullArgField(stringListNonNullArg: [String!]): String
    complexArgField(complexArg: ComplexInput): String
    multipleReqs(req1: Int!, req2: Int!): String
    nonNullFieldWithDefault(arg: Int! = 0): String
    multipleOpts(opt1: Int = 0, opt2: Int = 0): String
    multipleOptAndReq(req1: Int!, req2: Int!, opt1: Int = 0, opt2: Int = 0): String
  }

  type QueryRoot {
    human(id: ID): Human
    dog: Dog
    cat: Cat
    pet: Pet
    catOrDog: CatOrDog
    complicatedArgs: ComplicatedArgs
  }

  schema {
    query: QueryRoot
  }

  directive @onField on FIELD
`);

export function expectValidationErrorsWithSchema(
  schema: GraphQLSchema,
  rule: ValidationRule,
  queryStr: string,
): any {
  const doc = parse(queryStr);
  const errors = validate(schema, doc, [rule]);
  return expectJSON(errors);
}

export function expectValidationErrors(
  rule: ValidationRule,
  queryStr: string,
): any {
  return expectValidationErrorsWithSchema(testSchema, rule, queryStr);
}

export function expectSDLValidationErrors(
  schema: Maybe<GraphQLSchema>,
  rule: SDLValidationRule,
  sdlStr: string,
): any {
  const doc = parse(sdlStr);
  const errors = validateSDL(doc, schema, [rule]);
  return expectJSON(errors);
}
