// @flow strict

import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema';

import { KnownTypeNames } from '../rules/KnownTypeNames';

import {
  expectValidationErrors,
  expectValidationErrorsWithSchema,
  expectSDLValidationErrors,
} from './harness';

function expectErrors(queryStr) {
  return expectValidationErrors(KnownTypeNames, queryStr);
}

function expectErrorsWithSchema(schema, queryStr) {
  return expectValidationErrorsWithSchema(schema, KnownTypeNames, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function expectSDLErrors(sdlStr, schema) {
  return expectSDLValidationErrors(schema, KnownTypeNames, sdlStr);
}

function expectValidSDL(sdlStr, schema) {
  expectSDLErrors(sdlStr, schema).to.deep.equal([]);
}

describe('Validate: Known type names', () => {
  it('known type names are valid', () => {
    expectValid(`
      query Foo($var: String, $required: [String!]!) {
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
      query Foo($var: JumbledUpLetters) {
        user(id: 4) {
          name
          pets { ... on Badger { name }, ...PetFields }
        }
      }
      fragment PetFields on Peettt {
        name
      }
    `).to.deep.equal([
      {
        message: 'Unknown type "JumbledUpLetters".',
        locations: [{ line: 2, column: 23 }],
      },
      {
        message: 'Unknown type "Badger".',
        locations: [{ line: 5, column: 25 }],
      },
      {
        message: 'Unknown type "Peettt". Did you mean "Pet"?',
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
    expectErrorsWithSchema(schema, query).to.deep.equal([
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
    it('use standard scalars', () => {
      expectValidSDL(`
        type Query {
          string: String
          int: Int
          float: Float
          boolean: Boolean
          id: ID
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
      `).to.deep.equal([
        {
          message: 'Unknown type "C". Did you mean "A" or "B"?',
          locations: [{ line: 5, column: 36 }],
        },
        {
          message: 'Unknown type "D". Did you mean "ID", "A", or "B"?',
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
          message: 'Unknown type "I". Did you mean "ID", "A", or "B"?',
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

    it('doesnot consider non-type definitions', () => {
      expectSDLErrors(`
        query Foo { __typename }
        fragment Foo on Query { __typename }
        directive @Foo on QUERY

        type Query {
          foo: Foo
        }
      `).to.deep.equal([
        {
          message: 'Unknown type "Foo".',
          locations: [{ line: 7, column: 16 }],
        },
      ]);
    });

    it('reference standard scalars inside extension document', () => {
      const schema = buildSchema('type Foo');
      const sdl = `
        type SomeType {
          string: String
          int: Int
          float: Float
          boolean: Boolean
          id: ID
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

      expectSDLErrors(sdl, schema).to.deep.equal([
        {
          message: 'Unknown type "C". Did you mean "A" or "B"?',
          locations: [{ line: 4, column: 36 }],
        },
        {
          message: 'Unknown type "D". Did you mean "ID", "A", or "B"?',
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
          message: 'Unknown type "I". Did you mean "ID", "A", or "B"?',
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
