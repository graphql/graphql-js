/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { buildSchema } from '../../utilities';
import {
  expectValidationErrors,
  expectValidationErrorsWithSchema,
  expectSDLValidationErrors,
} from './harness';
import { KnownTypeNames, unknownTypeMessage } from '../rules/KnownTypeNames';

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

function unknownType(typeName, suggestedTypes, line, column) {
  return {
    message: unknownTypeMessage(typeName, suggestedTypes),
    locations: [{ line, column }],
  };
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
      unknownType('JumbledUpLetters', [], 2, 23),
      unknownType('Badger', [], 5, 25),
      unknownType('Peettt', ['Pet'], 8, 29),
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
      unknownType('ID', [], 2, 19),
      unknownType('Float', [], 2, 31),
      unknownType('Int', [], 2, 44),
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
        unknownType('C', ['A', 'B'], 5, 36),
        unknownType('D', ['ID', 'A', 'B'], 6, 16),
        unknownType('E', ['A', 'B'], 6, 20),
        unknownType('F', ['A', 'B'], 9, 27),
        unknownType('G', ['A', 'B'], 9, 31),
        unknownType('H', ['A', 'B'], 12, 16),
        unknownType('I', ['ID', 'A', 'B'], 12, 20),
        unknownType('J', ['A', 'B'], 16, 14),
        unknownType('K', ['A', 'B'], 19, 37),
        unknownType('L', ['A', 'B'], 22, 18),
        unknownType('M', ['A', 'B'], 23, 21),
        unknownType('N', ['A', 'B'], 24, 25),
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
      `).to.deep.equal([unknownType('Foo', [], 7, 16)]);
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
        unknownType('C', ['A', 'B'], 4, 36),
        unknownType('D', ['ID', 'A', 'B'], 5, 16),
        unknownType('E', ['A', 'B'], 5, 20),
        unknownType('F', ['A', 'B'], 8, 27),
        unknownType('G', ['A', 'B'], 8, 31),
        unknownType('H', ['A', 'B'], 11, 16),
        unknownType('I', ['ID', 'A', 'B'], 11, 20),
        unknownType('J', ['A', 'B'], 15, 14),
        unknownType('K', ['A', 'B'], 18, 37),
        unknownType('L', ['A', 'B'], 21, 18),
        unknownType('M', ['A', 'B'], 22, 21),
        unknownType('N', ['A', 'B'], 23, 25),
      ]);
    });
  });
});
