import { describe, it } from 'mocha';

import { parse } from '../../language/parser';

import type { GraphQLSchema } from '../../type/schema';

import { extendSchema } from '../../utilities/extendSchema';

import { UniqueDirectivesPerLocationRule } from '../rules/UniqueDirectivesPerLocationRule';

import {
  expectSDLValidationErrors,
  expectValidationErrorsWithSchema,
  testSchema,
} from './harness';

const extensionSDL = `
  directive @directive on FIELD | FRAGMENT_DEFINITION
  directive @directiveA on FIELD | FRAGMENT_DEFINITION
  directive @directiveB on FIELD | FRAGMENT_DEFINITION
  directive @repeatable repeatable on FIELD | FRAGMENT_DEFINITION
`;
const schemaWithDirectives = extendSchema(testSchema, parse(extensionSDL));

function expectErrors(queryStr: string) {
  return expectValidationErrorsWithSchema(
    schemaWithDirectives,
    UniqueDirectivesPerLocationRule,
    queryStr,
  );
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  return expectSDLValidationErrors(
    schema,
    UniqueDirectivesPerLocationRule,
    sdlStr,
  );
}

describe('Validate: Directives Are Unique Per Location', () => {
  it('no directives', () => {
    expectValid(`
      fragment Test on Type {
        field
      }
    `);
  });

  it('unique directives in different locations', () => {
    expectValid(`
      fragment Test on Type @directiveA {
        field @directiveB
      }
    `);
  });

  it('unique directives in same locations', () => {
    expectValid(`
      fragment Test on Type @directiveA @directiveB {
        field @directiveA @directiveB
      }
    `);
  });

  it('same directives in different locations', () => {
    expectValid(`
      fragment Test on Type @directiveA {
        field @directiveA
      }
    `);
  });

  it('same directives in similar locations', () => {
    expectValid(`
      fragment Test on Type {
        field @directive
        field @directive
      }
    `);
  });

  it('repeatable directives in same location', () => {
    expectValid(`
      fragment Test on Type @repeatable @repeatable {
        field @repeatable @repeatable
      }
    `);
  });

  it('unknown directives must be ignored', () => {
    expectValid(`
      type Test @unknown @unknown {
        field: String! @unknown @unknown
      }

      extend type Test @unknown {
        anotherField: String!
      }
    `);
  });

  it('duplicate directives in one location', () => {
    expectErrors(`
      fragment Test on Type {
        field @directive @directive
      }
    `).toDeepEqual([
      {
        message:
          'The directive "@directive" can only be used once at this location.',
        locations: [
          { line: 3, column: 15 },
          { line: 3, column: 26 },
        ],
      },
    ]);
  });

  it('many duplicate directives in one location', () => {
    expectErrors(`
      fragment Test on Type {
        field @directive @directive @directive
      }
    `).toDeepEqual([
      {
        message:
          'The directive "@directive" can only be used once at this location.',
        locations: [
          { line: 3, column: 15 },
          { line: 3, column: 26 },
        ],
      },
      {
        message:
          'The directive "@directive" can only be used once at this location.',
        locations: [
          { line: 3, column: 15 },
          { line: 3, column: 37 },
        ],
      },
    ]);
  });

  it('different duplicate directives in one location', () => {
    expectErrors(`
      fragment Test on Type {
        field @directiveA @directiveB @directiveA @directiveB
      }
    `).toDeepEqual([
      {
        message:
          'The directive "@directiveA" can only be used once at this location.',
        locations: [
          { line: 3, column: 15 },
          { line: 3, column: 39 },
        ],
      },
      {
        message:
          'The directive "@directiveB" can only be used once at this location.',
        locations: [
          { line: 3, column: 27 },
          { line: 3, column: 51 },
        ],
      },
    ]);
  });

  it('duplicate directives in many locations', () => {
    expectErrors(`
      fragment Test on Type @directive @directive {
        field @directive @directive
      }
    `).toDeepEqual([
      {
        message:
          'The directive "@directive" can only be used once at this location.',
        locations: [
          { line: 2, column: 29 },
          { line: 2, column: 40 },
        ],
      },
      {
        message:
          'The directive "@directive" can only be used once at this location.',
        locations: [
          { line: 3, column: 15 },
          { line: 3, column: 26 },
        ],
      },
    ]);
  });

  it('duplicate directives on SDL definitions', () => {
    expectSDLErrors(`
      directive @nonRepeatable on
        SCHEMA | SCALAR | OBJECT | INTERFACE | UNION | INPUT_OBJECT

      schema @nonRepeatable @nonRepeatable { query: Dummy }

      scalar TestScalar @nonRepeatable @nonRepeatable
      type TestObject @nonRepeatable @nonRepeatable
      interface TestInterface @nonRepeatable @nonRepeatable
      union TestUnion @nonRepeatable @nonRepeatable
      input TestInput @nonRepeatable @nonRepeatable
    `).toDeepEqual([
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 5, column: 14 },
          { line: 5, column: 29 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 7, column: 25 },
          { line: 7, column: 40 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 8, column: 23 },
          { line: 8, column: 38 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 9, column: 31 },
          { line: 9, column: 46 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 10, column: 23 },
          { line: 10, column: 38 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 11, column: 23 },
          { line: 11, column: 38 },
        ],
      },
    ]);
  });

  it('duplicate directives on SDL extensions', () => {
    expectSDLErrors(`
      directive @nonRepeatable on
        SCHEMA | SCALAR | OBJECT | INTERFACE | UNION | INPUT_OBJECT

      extend schema @nonRepeatable @nonRepeatable

      extend scalar TestScalar @nonRepeatable @nonRepeatable
      extend type TestObject @nonRepeatable @nonRepeatable
      extend interface TestInterface @nonRepeatable @nonRepeatable
      extend union TestUnion @nonRepeatable @nonRepeatable
      extend input TestInput @nonRepeatable @nonRepeatable
    `).toDeepEqual([
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 5, column: 21 },
          { line: 5, column: 36 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 7, column: 32 },
          { line: 7, column: 47 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 8, column: 30 },
          { line: 8, column: 45 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 9, column: 38 },
          { line: 9, column: 53 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 10, column: 30 },
          { line: 10, column: 45 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 11, column: 30 },
          { line: 11, column: 45 },
        ],
      },
    ]);
  });

  it('duplicate directives between SDL definitions and extensions', () => {
    expectSDLErrors(`
      directive @nonRepeatable on SCHEMA

      schema @nonRepeatable { query: Dummy }
      extend schema @nonRepeatable
    `).toDeepEqual([
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 4, column: 14 },
          { line: 5, column: 21 },
        ],
      },
    ]);

    expectSDLErrors(`
      directive @nonRepeatable on SCALAR

      scalar TestScalar @nonRepeatable
      extend scalar TestScalar @nonRepeatable
      scalar TestScalar @nonRepeatable
    `).toDeepEqual([
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 4, column: 25 },
          { line: 5, column: 32 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 4, column: 25 },
          { line: 6, column: 25 },
        ],
      },
    ]);

    expectSDLErrors(`
      directive @nonRepeatable on OBJECT

      extend type TestObject @nonRepeatable
      type TestObject @nonRepeatable
      extend type TestObject @nonRepeatable
    `).toDeepEqual([
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 4, column: 30 },
          { line: 5, column: 23 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 4, column: 30 },
          { line: 6, column: 30 },
        ],
      },
    ]);
  });
});
