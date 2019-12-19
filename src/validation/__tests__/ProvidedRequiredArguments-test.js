// @flow strict

import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema';

import {
  ProvidedRequiredArguments,
  ProvidedRequiredArgumentsOnDirectives,
} from '../rules/ProvidedRequiredArguments';

import { expectValidationErrors, expectSDLValidationErrors } from './harness';

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

describe('Validate: Provided required arguments', () => {
  it('ignores unknown arguments', () => {
    expectValid(`
      {
        dog {
          isHouseTrained(unknownArgument: true)
        }
      }
    `);
  });

  describe('Valid non-nullable value', () => {
    it('Arg on optional arg', () => {
      expectValid(`
        {
          dog {
            isHouseTrained(atOtherHomes: true)
          }
        }
      `);
    });

    it('No Arg on optional arg', () => {
      expectValid(`
        {
          dog {
            isHouseTrained
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

    it('Multiple required args on mixedList', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4)
          }
        }
      `);
    });

    it('Multiple required and one optional arg on mixedList', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4, opt1: 5)
          }
        }
      `);
    });

    it('All required and optional args on mixedList', () => {
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
        {
          message:
            'Field "multipleReqs" argument "req1" of type "Int!" is required, but it was not provided.',
          locations: [{ line: 4, column: 13 }],
        },
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
        {
          message:
            'Field "multipleReqs" argument "req1" of type "Int!" is required, but it was not provided.',
          locations: [{ line: 4, column: 13 }],
        },
        {
          message:
            'Field "multipleReqs" argument "req2" of type "Int!" is required, but it was not provided.',
          locations: [{ line: 4, column: 13 }],
        },
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
        {
          message:
            'Field "multipleReqs" argument "req2" of type "Int!" is required, but it was not provided.',
          locations: [{ line: 4, column: 13 }],
        },
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
        {
          message:
            'Directive "@include" argument "if" of type "Boolean!" is required, but it was not provided.',
          locations: [{ line: 3, column: 15 }],
        },
        {
          message:
            'Directive "@skip" argument "if" of type "Boolean!" is required, but it was not provided.',
          locations: [{ line: 4, column: 18 }],
        },
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
      `).to.deep.equal([
        {
          message:
            'Directive "@test" argument "arg" of type "String!" is required, but it was not provided.',
          locations: [{ line: 3, column: 23 }],
        },
      ]);
    });

    it('Missing arg on standard directive', () => {
      expectSDLErrors(`
        type Query {
          foo: String @include
        }
      `).to.deep.equal([
        {
          message:
            'Directive "@include" argument "if" of type "Boolean!" is required, but it was not provided.',
          locations: [{ line: 3, column: 23 }],
        },
      ]);
    });

    it('Missing arg on overridden standard directive', () => {
      expectSDLErrors(`
        type Query {
          foo: String @deprecated
        }
        directive @deprecated(reason: String!) on FIELD
      `).to.deep.equal([
        {
          message:
            'Directive "@deprecated" argument "reason" of type "String!" is required, but it was not provided.',
          locations: [{ line: 3, column: 23 }],
        },
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
      ).to.deep.equal([
        {
          message:
            'Directive "@test" argument "arg" of type "String!" is required, but it was not provided.',
          locations: [{ line: 4, column: 30 }],
        },
      ]);
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
      ).to.deep.equal([
        {
          message:
            'Directive "@test" argument "arg" of type "String!" is required, but it was not provided.',
          locations: [{ line: 2, column: 29 }],
        },
      ]);
    });
  });
});
