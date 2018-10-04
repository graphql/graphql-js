/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import {
  expectPassesRule,
  expectFailsRule,
  expectSDLErrorsFromRule,
} from './harness';

import {
  UniqueDirectivesPerLocation,
  duplicateDirectiveMessage,
} from '../rules/UniqueDirectivesPerLocation';

const expectSDLErrors = expectSDLErrorsFromRule.bind(
  undefined,
  UniqueDirectivesPerLocation,
);

function duplicateDirective(directiveName, l1, c1, l2, c2) {
  return {
    message: duplicateDirectiveMessage(directiveName),
    locations: [{ line: l1, column: c1 }, { line: l2, column: c2 }],
  };
}

describe('Validate: Directives Are Unique Per Location', () => {
  it('no directives', () => {
    expectPassesRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type {
        field
      }
    `,
    );
  });

  it('unique directives in different locations', () => {
    expectPassesRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type @genericDirectiveA {
        field @genericDirectiveB
      }
    `,
    );
  });

  it('unique directives in same locations', () => {
    expectPassesRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type @genericDirectiveA @genericDirectiveB {
        field @genericDirectiveA @genericDirectiveB
      }
    `,
    );
  });

  it('same directives in different locations', () => {
    expectPassesRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type @genericDirectiveA {
        field @genericDirectiveA
      }
    `,
    );
  });

  it('same directives in similar locations', () => {
    expectPassesRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type {
        field @genericDirectiveA
        field @genericDirectiveA
      }
    `,
    );
  });

  it('repeatable directives in same location', () => {
    expectPassesRule(
      UniqueDirectivesPerLocation,
      `
      type Test @repeatableDirective(id: 1) @repeatableDirective(id: 2) {
        field: String!
      }
    `,
    );
  });

  it('repeatable directives in similar locations', () => {
    expectPassesRule(
      UniqueDirectivesPerLocation,
      `
      type Test @repeatableDirective(id: 1) {
        field: String!
      }
      
      extend type Test @repeatableDirective(id: 2) {
        anotherField: String!
      }
    `,
    );
  });

  it('unknown directives must be ignored', () => {
    expectPassesRule(
      UniqueDirectivesPerLocation,
      `
      type Test @unknownDirective @unknownDirective {
        field: String! 
      }
      
      extend type Test @unknownDirective {
        anotherField: String!
      }
    `,
    );
  });

  it('duplicate directives in one location', () => {
    expectFailsRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type {
        field @genericDirectiveA @genericDirectiveA
      }
    `,
      [duplicateDirective('genericDirectiveA', 3, 15, 3, 34)],
    );
  });

  it('many duplicate directives in one location', () => {
    expectFailsRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type {
        field @genericDirectiveA @genericDirectiveA @genericDirectiveA
      }
    `,
      [
        duplicateDirective('genericDirectiveA', 3, 15, 3, 34),
        duplicateDirective('genericDirectiveA', 3, 15, 3, 53),
      ],
    );
  });

  it('different duplicate directives in one location', () => {
    expectFailsRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type {
        field @genericDirectiveA @genericDirectiveB @genericDirectiveA @genericDirectiveB
      }
    `,
      [
        duplicateDirective('genericDirectiveA', 3, 15, 3, 53),
        duplicateDirective('genericDirectiveB', 3, 34, 3, 72),
      ],
    );
  });

  it('duplicate directives in many locations', () => {
    expectFailsRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type @genericDirectiveA @genericDirectiveA {
        field @genericDirectiveA @genericDirectiveA
      }
    `,
      [
        duplicateDirective('genericDirectiveA', 2, 29, 2, 48),
        duplicateDirective('genericDirectiveA', 3, 15, 3, 34),
      ],
    );
  });

  it('duplicate directives on SDL definitions', () => {
    expectSDLErrors(`
      directive @directive on 
        | SCHEMA  
        | SCALAR
        | OBJECT
        | INTERFACE
        | UNION
        | INPUT_OBJECT
          
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
      duplicateDirective('directive', 10, 14, 10, 25),
      duplicateDirective('directive', 11, 21, 11, 32),
      duplicateDirective('directive', 13, 25, 13, 36),
      duplicateDirective('directive', 14, 32, 14, 43),
      duplicateDirective('directive', 16, 23, 16, 34),
      duplicateDirective('directive', 17, 30, 17, 41),
      duplicateDirective('directive', 19, 31, 19, 42),
      duplicateDirective('directive', 20, 38, 20, 49),
      duplicateDirective('directive', 22, 23, 22, 34),
      duplicateDirective('directive', 23, 30, 23, 41),
      duplicateDirective('directive', 25, 23, 25, 34),
      duplicateDirective('directive', 26, 30, 26, 41),
    ]);
  });
});
