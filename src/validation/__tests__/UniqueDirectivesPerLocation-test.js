// @flow strict

import { describe, it } from 'mocha';
import {
  testSchema,
  expectValidationErrorsWithSchema,
  expectSDLValidationErrors,
} from './harness';

import { parse } from '../../language/parser';
import { extendSchema } from '../../utilities/extendSchema';
import {
  UniqueDirectivesPerLocation,
  duplicateDirectiveMessage,
} from '../rules/UniqueDirectivesPerLocation';

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

function duplicateDirective(directiveName, l1, c1, l2, c2) {
  return {
    message: duplicateDirectiveMessage(directiveName),
    locations: [{ line: l1, column: c1 }, { line: l2, column: c2 }],
  };
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
    `).to.deep.equal([duplicateDirective('directive', 3, 15, 3, 26)]);
  });

  it('many duplicate directives in one location', () => {
    expectErrors(`
      fragment Test on Type {
        field @directive @directive @directive
      }
    `).to.deep.equal([
      duplicateDirective('directive', 3, 15, 3, 26),
      duplicateDirective('directive', 3, 15, 3, 37),
    ]);
  });

  it('different duplicate directives in one location', () => {
    expectErrors(`
      fragment Test on Type {
        field @directiveA @directiveB @directiveA @directiveB
      }
    `).to.deep.equal([
      duplicateDirective('directiveA', 3, 15, 3, 39),
      duplicateDirective('directiveB', 3, 27, 3, 51),
    ]);
  });

  it('duplicate directives in many locations', () => {
    expectErrors(`
      fragment Test on Type @directive @directive {
        field @directive @directive
      }
    `).to.deep.equal([
      duplicateDirective('directive', 2, 29, 2, 40),
      duplicateDirective('directive', 3, 15, 3, 26),
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
      duplicateDirective('nonRepeatable', 5, 14, 5, 29),
      duplicateDirective('nonRepeatable', 6, 21, 6, 36),
      duplicateDirective('nonRepeatable', 8, 25, 8, 40),
      duplicateDirective('nonRepeatable', 9, 32, 9, 47),
      duplicateDirective('nonRepeatable', 11, 23, 11, 38),
      duplicateDirective('nonRepeatable', 12, 30, 12, 45),
      duplicateDirective('nonRepeatable', 14, 31, 14, 46),
      duplicateDirective('nonRepeatable', 15, 38, 15, 53),
      duplicateDirective('nonRepeatable', 17, 23, 17, 38),
      duplicateDirective('nonRepeatable', 18, 30, 18, 45),
      duplicateDirective('nonRepeatable', 20, 23, 20, 38),
      duplicateDirective('nonRepeatable', 21, 30, 21, 45),
    ]);
  });
});
