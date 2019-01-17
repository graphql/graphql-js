/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expectValidationErrors, expectSDLValidationErrors } from './harness';

import {
  UniqueDirectivesPerLocation,
  duplicateDirectiveMessage,
} from '../rules/UniqueDirectivesPerLocation';

function expectErrors(queryStr) {
  return expectValidationErrors(UniqueDirectivesPerLocation, queryStr);
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
      schema @directive @directive { query: Dummy }
      extend schema @directive @directive

      scalar TestScalar @directive @directive
      extend scalar TestScalar @directive @directive

      type TestObject @directive @directive
      extend type TestObject @directive @directive

      interface TestInterface @directive @directive
      extend interface TestInterface @directive @directive

      union TestUnion @directive @directive
      extend union TestUnion @directive @directive

      input TestInput @directive @directive
      extend input TestInput @directive @directive
    `).to.deep.equal([
      duplicateDirective('directive', 2, 14, 2, 25),
      duplicateDirective('directive', 3, 21, 3, 32),
      duplicateDirective('directive', 5, 25, 5, 36),
      duplicateDirective('directive', 6, 32, 6, 43),
      duplicateDirective('directive', 8, 23, 8, 34),
      duplicateDirective('directive', 9, 30, 9, 41),
      duplicateDirective('directive', 11, 31, 11, 42),
      duplicateDirective('directive', 12, 38, 12, 49),
      duplicateDirective('directive', 14, 23, 14, 34),
      duplicateDirective('directive', 15, 30, 15, 41),
      duplicateDirective('directive', 17, 23, 17, 34),
      duplicateDirective('directive', 18, 30, 18, 41),
    ]);
  });
});
