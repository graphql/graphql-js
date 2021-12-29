import { describe, it } from 'mocha';

import type { GraphQLSchema } from '../../type/schema';

import { buildSchema } from '../../utilities/buildASTSchema';

import { KnownTypeNamesRule } from '../rules/KnownTypeNamesRule';

import {
  expectSDLValidationErrors,
  expectValidationErrors,
  expectValidationErrorsWithSchema,
} from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(KnownTypeNamesRule, queryStr);
}

function expectErrorsWithSchema(schema: GraphQLSchema, queryStr: string) {
  return expectValidationErrorsWithSchema(schema, KnownTypeNamesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  return expectSDLValidationErrors(schema, KnownTypeNamesRule, sdlStr);
}

function expectValidSDL(sdlStr: string, schema?: GraphQLSchema) {
  expectSDLErrors(sdlStr, schema).toDeepEqual([]);
}

describe('Validate: Known type names', () => {
  it('known type names are valid', () => {
    expectValid(`
      query Foo(
        $var: String
        $required: [Int!]!
        $introspectionType: __EnumValue
      ) {
        user(id: 4) {
          pets { ... on Pet { name }, ...PetFields, ... { name } }
        }
      }

      fragment PetFields on Pet {
        name
      }
    `);
  });

  it('unknown type names are invalid', () => {
    expectErrors(`
      query Foo($var: [JumbledUpLetters!]!) {
        user(id: 4) {
          name
          pets { ... on Badger { name }, ...PetFields }
        }
      }
      fragment PetFields on Peat {
        name
      }
    `).toDeepEqual([
      {
        message: 'Unknown type "JumbledUpLetters".',
        locations: [{ line: 2, column: 24 }],
      },
      {
        message: 'Unknown type "Badger".',
        locations: [{ line: 5, column: 25 }],
      },
      {
        message: 'Unknown type "Peat". Did you mean "Pet" or "Cat"?',
        locations: [{ line: 8, column: 29 }],
      },
    ]);
  });

  it('references to standard scalars that are missing in schema', () => {
    const schema = buildSchema('type Query { foo: String }');
    const query = `
      query ($id: ID, $float: Float, $int: Int) {
        __typename
      }
    `;
    expectErrorsWithSchema(schema, query).toDeepEqual([
      {
        message: 'Unknown type "ID".',
        locations: [{ line: 2, column: 19 }],
      },
      {
        message: 'Unknown type "Float".',
        locations: [{ line: 2, column: 31 }],
      },
      {
        message: 'Unknown type "Int".',
        locations: [{ line: 2, column: 44 }],
      },
    ]);
  });

  describe('within SDL', () => {
    it('use standard types', () => {
      expectValidSDL(`
        type Query {
          string: String
          int: Int
          float: Float
          boolean: Boolean
          id: ID
          introspectionType: __EnumValue
        }
      `);
    });

    it('reference types defined inside the same document', () => {
      expectValidSDL(`
        union SomeUnion = SomeObject | AnotherObject

        type SomeObject implements SomeInterface {
          someScalar(arg: SomeInputObject): SomeScalar
        }

        type AnotherObject {
          foo(arg: SomeInputObject): String
        }

        type SomeInterface {
          someScalar(arg: SomeInputObject): SomeScalar
        }

        input SomeInputObject {
          someScalar: SomeScalar
        }

        scalar SomeScalar

        type RootQuery {
          someInterface: SomeInterface
          someUnion: SomeUnion
          someScalar: SomeScalar
          someObject: SomeObject
        }

        schema {
          query: RootQuery
        }
      `);
    });

    it('unknown type references', () => {
      expectSDLErrors(`
        type A
        type B

        type SomeObject implements C {
          e(d: D): E
        }

        union SomeUnion = F | G

        interface SomeInterface {
          i(h: H): I
        }

        input SomeInput {
          j: J
        }

        directive @SomeDirective(k: K) on QUERY

        schema {
          query: L
          mutation: M
          subscription: N
        }
      `).toDeepEqual([
        {
          message: 'Unknown type "C". Did you mean "A" or "B"?',
          locations: [{ line: 5, column: 36 }],
        },
        {
          message: 'Unknown type "D". Did you mean "A", "B", or "ID"?',
          locations: [{ line: 6, column: 16 }],
        },
        {
          message: 'Unknown type "E". Did you mean "A" or "B"?',
          locations: [{ line: 6, column: 20 }],
        },
        {
          message: 'Unknown type "F". Did you mean "A" or "B"?',
          locations: [{ line: 9, column: 27 }],
        },
        {
          message: 'Unknown type "G". Did you mean "A" or "B"?',
          locations: [{ line: 9, column: 31 }],
        },
        {
          message: 'Unknown type "H". Did you mean "A" or "B"?',
          locations: [{ line: 12, column: 16 }],
        },
        {
          message: 'Unknown type "I". Did you mean "A", "B", or "ID"?',
          locations: [{ line: 12, column: 20 }],
        },
        {
          message: 'Unknown type "J". Did you mean "A" or "B"?',
          locations: [{ line: 16, column: 14 }],
        },
        {
          message: 'Unknown type "K". Did you mean "A" or "B"?',
          locations: [{ line: 19, column: 37 }],
        },
        {
          message: 'Unknown type "L". Did you mean "A" or "B"?',
          locations: [{ line: 22, column: 18 }],
        },
        {
          message: 'Unknown type "M". Did you mean "A" or "B"?',
          locations: [{ line: 23, column: 21 }],
        },
        {
          message: 'Unknown type "N". Did you mean "A" or "B"?',
          locations: [{ line: 24, column: 25 }],
        },
      ]);
    });

    it('does not consider non-type definitions', () => {
      expectSDLErrors(`
        query Foo { __typename }
        fragment Foo on Query { __typename }
        directive @Foo on QUERY

        type Query {
          foo: Foo
        }
      `).toDeepEqual([
        {
          message: 'Unknown type "Foo".',
          locations: [{ line: 7, column: 16 }],
        },
      ]);
    });

    it('reference standard types inside extension document', () => {
      const schema = buildSchema('type Foo');
      const sdl = `
        type SomeType {
          string: String
          int: Int
          float: Float
          boolean: Boolean
          id: ID
          introspectionType: __EnumValue
        }
      `;

      expectValidSDL(sdl, schema);
    });

    it('reference types inside extension document', () => {
      const schema = buildSchema('type Foo');
      const sdl = `
        type QueryRoot {
          foo: Foo
          bar: Bar
        }

        scalar Bar

        schema {
          query: QueryRoot
        }
      `;

      expectValidSDL(sdl, schema);
    });

    it('unknown type references inside extension document', () => {
      const schema = buildSchema('type A');
      const sdl = `
        type B

        type SomeObject implements C {
          e(d: D): E
        }

        union SomeUnion = F | G

        interface SomeInterface {
          i(h: H): I
        }

        input SomeInput {
          j: J
        }

        directive @SomeDirective(k: K) on QUERY

        schema {
          query: L
          mutation: M
          subscription: N
        }
      `;

      expectSDLErrors(sdl, schema).toDeepEqual([
        {
          message: 'Unknown type "C". Did you mean "A" or "B"?',
          locations: [{ line: 4, column: 36 }],
        },
        {
          message: 'Unknown type "D". Did you mean "A", "B", or "ID"?',
          locations: [{ line: 5, column: 16 }],
        },
        {
          message: 'Unknown type "E". Did you mean "A" or "B"?',
          locations: [{ line: 5, column: 20 }],
        },
        {
          message: 'Unknown type "F". Did you mean "A" or "B"?',
          locations: [{ line: 8, column: 27 }],
        },
        {
          message: 'Unknown type "G". Did you mean "A" or "B"?',
          locations: [{ line: 8, column: 31 }],
        },
        {
          message: 'Unknown type "H". Did you mean "A" or "B"?',
          locations: [{ line: 11, column: 16 }],
        },
        {
          message: 'Unknown type "I". Did you mean "A", "B", or "ID"?',
          locations: [{ line: 11, column: 20 }],
        },
        {
          message: 'Unknown type "J". Did you mean "A" or "B"?',
          locations: [{ line: 15, column: 14 }],
        },
        {
          message: 'Unknown type "K". Did you mean "A" or "B"?',
          locations: [{ line: 18, column: 37 }],
        },
        {
          message: 'Unknown type "L". Did you mean "A" or "B"?',
          locations: [{ line: 21, column: 18 }],
        },
        {
          message: 'Unknown type "M". Did you mean "A" or "B"?',
          locations: [{ line: 22, column: 21 }],
        },
        {
          message: 'Unknown type "N". Did you mean "A" or "B"?',
          locations: [{ line: 23, column: 25 }],
        },
      ]);
    });
  });
});
