// @flow strict

import { describe, it } from 'mocha';

import { parse } from '../../language/parser';
import { extendSchema } from '../../utilities/extendSchema';

import { UniqueDirectivesPerLocation } from '../rules/UniqueDirectivesPerLocation';

import {
  testSchema,
  expectValidationErrorsWithSchema,
  expectSDLValidationErrors,
} from './harness';

const extensionSDL = `
  directive @directive on FIELD | FRAGMENT_DEFINITION
  directive @directiveA on FIELD | FRAGMENT_DEFINITION
  directive @directiveB on FIELD | FRAGMENT_DEFINITION
  directive @repeatable repeatable on FIELD | FRAGMENT_DEFINITION
`;
const schemaWithDirectives = extendSchema(testSchema, parse(extensionSDL));

function expectErrors(queryStr) {
  return expectValidationErrorsWithSchema(
    schemaWithDirectives,
    UniqueDirectivesPerLocation,
    queryStr,
  );
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function expectSDLErrors(sdlStr, schema) {
  return expectSDLValidationErrors(schema, UniqueDirectivesPerLocation, sdlStr);
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
    `).to.deep.equal([
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
    `).to.deep.equal([
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
    `).to.deep.equal([
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
    `).to.deep.equal([
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
      extend schema @nonRepeatable @nonRepeatable

      scalar TestScalar @nonRepeatable @nonRepeatable
      extend scalar TestScalar @nonRepeatable @nonRepeatable

      type TestObject @nonRepeatable @nonRepeatable
      extend type TestObject @nonRepeatable @nonRepeatable

      interface TestInterface @nonRepeatable @nonRepeatable
      extend interface TestInterface @nonRepeatable @nonRepeatable

      union TestUnion @nonRepeatable @nonRepeatable
      extend union TestUnion @nonRepeatable @nonRepeatable

      input TestInput @nonRepeatable @nonRepeatable
      extend input TestInput @nonRepeatable @nonRepeatable
    `).to.deep.equal([
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
          { line: 6, column: 21 },
          { line: 6, column: 36 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 8, column: 25 },
          { line: 8, column: 40 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 9, column: 32 },
          { line: 9, column: 47 },
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
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 12, column: 30 },
          { line: 12, column: 45 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 14, column: 31 },
          { line: 14, column: 46 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 15, column: 38 },
          { line: 15, column: 53 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 17, column: 23 },
          { line: 17, column: 38 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 18, column: 30 },
          { line: 18, column: 45 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 20, column: 23 },
          { line: 20, column: 38 },
        ],
      },
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
        locations: [
          { line: 21, column: 30 },
          { line: 21, column: 45 },
        ],
      },
    ]);
  });
});
