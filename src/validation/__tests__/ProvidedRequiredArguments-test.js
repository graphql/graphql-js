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
import { expectValidationErrors, expectSDLValidationErrors } from './harness';
import {
  ProvidedRequiredArguments,
  ProvidedRequiredArgumentsOnDirectives,
  missingFieldArgMessage,
  missingDirectiveArgMessage,
} from '../rules/ProvidedRequiredArguments';

function expectErrors(queryStr) {
  return expectValidationErrors(ProvidedRequiredArguments, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function expectSDLErrors(sdlStr, schema) {
  return expectSDLValidationErrors(
    schema,
    ProvidedRequiredArgumentsOnDirectives,
    sdlStr,
  );
}

function expectValidSDL(sdlStr) {
  expectSDLErrors(sdlStr).to.deep.equal([]);
}

function missingFieldArg(fieldName, argName, typeName, line, column) {
  return {
    message: missingFieldArgMessage(fieldName, argName, typeName),
    locations: [{ line, column }],
  };
}

function missingDirectiveArg(directiveName, argName, typeName, line, column) {
  return {
    message: missingDirectiveArgMessage(directiveName, argName, typeName),
    locations: [{ line, column }],
  };
}

describe('Validate: Provided required arguments', () => {
  it('ignores unknown arguments', () => {
    expectValid(`
      {
        dog {
          isHousetrained(unknownArgument: true)
        }
      }
    `);
  });

  describe('Valid non-nullable value', () => {
    it('Arg on optional arg', () => {
      expectValid(`
        {
          dog {
            isHousetrained(atOtherHomes: true)
          }
        }
      `);
    });

    it('No Arg on optional arg', () => {
      expectValid(`
        {
          dog {
            isHousetrained
          }
        }
      `);
    });

    it('No arg on non-null field with default', () => {
      expectValid(`
        {
          complicatedArgs {
            nonNullFieldWithDefault
          }
        }
      `);
    });

    it('Multiple args', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleReqs(req1: 1, req2: 2)
          }
        }
      `);
    });

    it('Multiple args reverse order', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleReqs(req2: 2, req1: 1)
          }
        }
      `);
    });

    it('No args on multiple optional', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOpts
          }
        }
      `);
    });

    it('One arg on multiple optional', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOpts(opt1: 1)
          }
        }
      `);
    });

    it('Second arg on multiple optional', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOpts(opt2: 1)
          }
        }
      `);
    });

    it('Multiple reqs on mixedList', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4)
          }
        }
      `);
    });

    it('Multiple reqs and one opt on mixedList', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4, opt1: 5)
          }
        }
      `);
    });

    it('All reqs and opts on mixedList', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4, opt1: 5, opt2: 6)
          }
        }
      `);
    });
  });

  describe('Invalid non-nullable value', () => {
    it('Missing one non-nullable argument', () => {
      expectErrors(`
        {
          complicatedArgs {
            multipleReqs(req2: 2)
          }
        }
      `).to.deep.equal([
        missingFieldArg('multipleReqs', 'req1', 'Int!', 4, 13),
      ]);
    });

    it('Missing multiple non-nullable arguments', () => {
      expectErrors(`
        {
          complicatedArgs {
            multipleReqs
          }
        }
      `).to.deep.equal([
        missingFieldArg('multipleReqs', 'req1', 'Int!', 4, 13),
        missingFieldArg('multipleReqs', 'req2', 'Int!', 4, 13),
      ]);
    });

    it('Incorrect value and missing argument', () => {
      expectErrors(`
        {
          complicatedArgs {
            multipleReqs(req1: "one")
          }
        }
      `).to.deep.equal([
        missingFieldArg('multipleReqs', 'req2', 'Int!', 4, 13),
      ]);
    });
  });

  describe('Directive arguments', () => {
    it('ignores unknown directives', () => {
      expectValid(`
        {
          dog @unknown
        }
      `);
    });

    it('with directives of valid types', () => {
      expectValid(`
        {
          dog @include(if: true) {
            name
          }
          human @skip(if: false) {
            name
          }
        }
      `);
    });

    it('with directive with missing types', () => {
      expectErrors(`
        {
          dog @include {
            name @skip
          }
        }
      `).to.deep.equal([
        missingDirectiveArg('include', 'if', 'Boolean!', 3, 15),
        missingDirectiveArg('skip', 'if', 'Boolean!', 4, 18),
      ]);
    });
  });

  describe('within SDL', () => {
    it('Missing optional args on directive defined inside SDL', () => {
      expectValidSDL(`
        type Query {
          foo: String @test
        }

        directive @test(arg1: String, arg2: String! = "") on FIELD_DEFINITION
      `);
    });

    it('Missing arg on directive defined inside SDL', () => {
      expectSDLErrors(`
        type Query {
          foo: String @test
        }

        directive @test(arg: String!) on FIELD_DEFINITION
      `).to.deep.equal([missingDirectiveArg('test', 'arg', 'String!', 3, 23)]);
    });

    it('Missing arg on standard directive', () => {
      expectSDLErrors(`
        type Query {
          foo: String @include
        }
      `).to.deep.equal([
        missingDirectiveArg('include', 'if', 'Boolean!', 3, 23),
      ]);
    });

    it('Missing arg on overridden standard directive', () => {
      expectSDLErrors(`
        type Query {
          foo: String @deprecated
        }
        directive @deprecated(reason: String!) on FIELD
      `).to.deep.equal([
        missingDirectiveArg('deprecated', 'reason', 'String!', 3, 23),
      ]);
    });

    it('Missing arg on directive defined in schema extension', () => {
      const schema = buildSchema(`
        type Query {
          foo: String
        }
      `);
      expectSDLErrors(
        `
          directive @test(arg: String!) on OBJECT

          extend type Query  @test
        `,
        schema,
      ).to.deep.equal([missingDirectiveArg('test', 'arg', 'String!', 4, 30)]);
    });

    it('Missing arg on directive used in schema extension', () => {
      const schema = buildSchema(`
        directive @test(arg: String!) on OBJECT

        type Query {
          foo: String
        }
      `);
      expectSDLErrors(
        `
          extend type Query @test
        `,
        schema,
      ).to.deep.equal([missingDirectiveArg('test', 'arg', 'String!', 2, 29)]);
    });
  });
});
