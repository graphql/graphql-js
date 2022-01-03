import { describe, it } from 'mocha';

import type { GraphQLSchema } from '../../type/schema';

import { buildSchema } from '../../utilities/buildASTSchema';

import {
  KnownArgumentNamesOnDirectivesRule,
  KnownArgumentNamesRule,
} from '../rules/KnownArgumentNamesRule';

import { expectSDLValidationErrors, expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(KnownArgumentNamesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  return expectSDLValidationErrors(
    schema,
    KnownArgumentNamesOnDirectivesRule,
    sdlStr,
  );
}

function expectValidSDL(sdlStr: string) {
  expectSDLErrors(sdlStr).toDeepEqual([]);
}

describe('Validate: Known argument names', () => {
  it('single arg is known', () => {
    expectValid(`
      fragment argOnRequiredArg on Dog {
        doesKnowCommand(dogCommand: SIT)
      }
    `);
  });

  it('multiple args are known', () => {
    expectValid(`
      fragment multipleArgs on ComplicatedArgs {
        multipleReqs(req1: 1, req2: 2)
      }
    `);
  });

  it('ignores args of unknown fields', () => {
    expectValid(`
      fragment argOnUnknownField on Dog {
        unknownField(unknownArg: SIT)
      }
    `);
  });

  it('multiple args in reverse order are known', () => {
    expectValid(`
      fragment multipleArgsReverseOrder on ComplicatedArgs {
        multipleReqs(req2: 2, req1: 1)
      }
    `);
  });

  it('no args on optional arg', () => {
    expectValid(`
      fragment noArgOnOptionalArg on Dog {
        isHouseTrained
      }
    `);
  });

  it('args are known deeply', () => {
    expectValid(`
      {
        dog {
          doesKnowCommand(dogCommand: SIT)
        }
        human {
          pet {
            ... on Dog {
              doesKnowCommand(dogCommand: SIT)
            }
          }
        }
      }
    `);
  });

  it('directive args are known', () => {
    expectValid(`
      {
        dog @skip(if: true)
      }
    `);
  });

  it('field args are invalid', () => {
    expectErrors(`
      {
        dog @skip(unless: true)
      }
    `).toDeepEqual([
      {
        message: 'Unknown argument "unless" on directive "@skip".',
        locations: [{ line: 3, column: 19 }],
      },
    ]);
  });

  it('directive without args is valid', () => {
    expectValid(`
      {
        dog @onField
      }
    `);
  });

  it('arg passed to directive without arg is reported', () => {
    expectErrors(`
      {
        dog @onField(if: true)
      }
    `).toDeepEqual([
      {
        message: 'Unknown argument "if" on directive "@onField".',
        locations: [{ line: 3, column: 22 }],
      },
    ]);
  });

  it('misspelled directive args are reported', () => {
    expectErrors(`
      {
        dog @skip(iff: true)
      }
    `).toDeepEqual([
      {
        message:
          'Unknown argument "iff" on directive "@skip". Did you mean "if"?',
        locations: [{ line: 3, column: 19 }],
      },
    ]);
  });

  it('invalid arg name', () => {
    expectErrors(`
      fragment invalidArgName on Dog {
        doesKnowCommand(unknown: true)
      }
    `).toDeepEqual([
      {
        message: 'Unknown argument "unknown" on field "Dog.doesKnowCommand".',
        locations: [{ line: 3, column: 25 }],
      },
    ]);
  });

  it('misspelled arg name is reported', () => {
    expectErrors(`
      fragment invalidArgName on Dog {
        doesKnowCommand(DogCommand: true)
      }
    `).toDeepEqual([
      {
        message:
          'Unknown argument "DogCommand" on field "Dog.doesKnowCommand". Did you mean "dogCommand"?',
        locations: [{ line: 3, column: 25 }],
      },
    ]);
  });

  it('unknown args amongst known args', () => {
    expectErrors(`
      fragment oneGoodArgOneInvalidArg on Dog {
        doesKnowCommand(whoKnows: 1, dogCommand: SIT, unknown: true)
      }
    `).toDeepEqual([
      {
        message: 'Unknown argument "whoKnows" on field "Dog.doesKnowCommand".',
        locations: [{ line: 3, column: 25 }],
      },
      {
        message: 'Unknown argument "unknown" on field "Dog.doesKnowCommand".',
        locations: [{ line: 3, column: 55 }],
      },
    ]);
  });

  it('unknown args deeply', () => {
    expectErrors(`
      {
        dog {
          doesKnowCommand(unknown: true)
        }
        human {
          pet {
            ... on Dog {
              doesKnowCommand(unknown: true)
            }
          }
        }
      }
    `).toDeepEqual([
      {
        message: 'Unknown argument "unknown" on field "Dog.doesKnowCommand".',
        locations: [{ line: 4, column: 27 }],
      },
      {
        message: 'Unknown argument "unknown" on field "Dog.doesKnowCommand".',
        locations: [{ line: 9, column: 31 }],
      },
    ]);
  });

  describe('within SDL', () => {
    it('known arg on directive defined inside SDL', () => {
      expectValidSDL(`
        type Query {
          foo: String @test(arg: "")
        }

        directive @test(arg: String) on FIELD_DEFINITION
      `);
    });

    it('unknown arg on directive defined inside SDL', () => {
      expectSDLErrors(`
        type Query {
          foo: String @test(unknown: "")
        }

        directive @test(arg: String) on FIELD_DEFINITION
      `).toDeepEqual([
        {
          message: 'Unknown argument "unknown" on directive "@test".',
          locations: [{ line: 3, column: 29 }],
        },
      ]);
    });

    it('misspelled arg name is reported on directive defined inside SDL', () => {
      expectSDLErrors(`
        type Query {
          foo: String @test(agr: "")
        }

        directive @test(arg: String) on FIELD_DEFINITION
      `).toDeepEqual([
        {
          message:
            'Unknown argument "agr" on directive "@test". Did you mean "arg"?',
          locations: [{ line: 3, column: 29 }],
        },
      ]);
    });

    it('unknown arg on standard directive', () => {
      expectSDLErrors(`
        type Query {
          foo: String @deprecated(unknown: "")
        }
      `).toDeepEqual([
        {
          message: 'Unknown argument "unknown" on directive "@deprecated".',
          locations: [{ line: 3, column: 35 }],
        },
      ]);
    });

    it('unknown arg on overridden standard directive', () => {
      expectSDLErrors(`
        type Query {
          foo: String @deprecated(reason: "")
        }
        directive @deprecated(arg: String) on FIELD
      `).toDeepEqual([
        {
          message: 'Unknown argument "reason" on directive "@deprecated".',
          locations: [{ line: 3, column: 35 }],
        },
      ]);
    });

    it('unknown arg on directive defined in schema extension', () => {
      const schema = buildSchema(`
        type Query {
          foo: String
        }
      `);
      expectSDLErrors(
        `
          directive @test(arg: String) on OBJECT

          extend type Query  @test(unknown: "")
        `,
        schema,
      ).toDeepEqual([
        {
          message: 'Unknown argument "unknown" on directive "@test".',
          locations: [{ line: 4, column: 36 }],
        },
      ]);
    });

    it('unknown arg on directive used in schema extension', () => {
      const schema = buildSchema(`
        directive @test(arg: String) on OBJECT

        type Query {
          foo: String
        }
      `);
      expectSDLErrors(
        `
          extend type Query @test(unknown: "")
        `,
        schema,
      ).toDeepEqual([
        {
          message: 'Unknown argument "unknown" on directive "@test".',
          locations: [{ line: 2, column: 35 }],
        },
      ]);
    });
  });
});
