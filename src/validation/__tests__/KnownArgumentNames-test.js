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
  KnownArgumentNames,
  KnownArgumentNamesOnDirectives,
  unknownArgMessage,
  unknownDirectiveArgMessage,
} from '../rules/KnownArgumentNames';

function expectErrors(queryStr) {
  return expectValidationErrors(KnownArgumentNames, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function expectSDLErrors(sdlStr, schema) {
  return expectSDLValidationErrors(
    schema,
    KnownArgumentNamesOnDirectives,
    sdlStr,
  );
}

function expectValidSDL(sdlStr) {
  expectSDLErrors(sdlStr).to.deep.equal([]);
}

function unknownArg(argName, fieldName, typeName, suggestedArgs, line, column) {
  return {
    message: unknownArgMessage(argName, fieldName, typeName, suggestedArgs),
    locations: [{ line, column }],
  };
}

function unknownDirectiveArg(
  argName,
  directiveName,
  suggestedArgs,
  line,
  column,
) {
  return {
    message: unknownDirectiveArgMessage(argName, directiveName, suggestedArgs),
    locations: [{ line, column }],
  };
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
        isHousetrained
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
    `).to.deep.equal([unknownDirectiveArg('unless', 'skip', [], 3, 19)]);
  });

  it('misspelled directive args are reported', () => {
    expectErrors(`
      {
        dog @skip(iff: true)
      }
    `).to.deep.equal([unknownDirectiveArg('iff', 'skip', ['if'], 3, 19)]);
  });

  it('invalid arg name', () => {
    expectErrors(`
      fragment invalidArgName on Dog {
        doesKnowCommand(unknown: true)
      }
    `).to.deep.equal([
      unknownArg('unknown', 'doesKnowCommand', 'Dog', [], 3, 25),
    ]);
  });

  it('misspelled arg name is reported', () => {
    expectErrors(`
      fragment invalidArgName on Dog {
        doesKnowCommand(dogcommand: true)
      }
    `).to.deep.equal([
      unknownArg('dogcommand', 'doesKnowCommand', 'Dog', ['dogCommand'], 3, 25),
    ]);
  });

  it('unknown args amongst known args', () => {
    expectErrors(`
      fragment oneGoodArgOneInvalidArg on Dog {
        doesKnowCommand(whoknows: 1, dogCommand: SIT, unknown: true)
      }
    `).to.deep.equal([
      unknownArg('whoknows', 'doesKnowCommand', 'Dog', [], 3, 25),
      unknownArg('unknown', 'doesKnowCommand', 'Dog', [], 3, 55),
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
    `).to.deep.equal([
      unknownArg('unknown', 'doesKnowCommand', 'Dog', [], 4, 27),
      unknownArg('unknown', 'doesKnowCommand', 'Dog', [], 9, 31),
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
      `).to.deep.equal([unknownDirectiveArg('unknown', 'test', [], 3, 29)]);
    });

    it('misspelled arg name is reported on directive defined inside SDL', () => {
      expectSDLErrors(`
        type Query {
          foo: String @test(agr: "")
        }

        directive @test(arg: String) on FIELD_DEFINITION
      `).to.deep.equal([unknownDirectiveArg('agr', 'test', ['arg'], 3, 29)]);
    });

    it('unknown arg on standard directive', () => {
      expectSDLErrors(`
        type Query {
          foo: String @deprecated(unknown: "")
        }
      `).to.deep.equal([
        unknownDirectiveArg('unknown', 'deprecated', [], 3, 35),
      ]);
    });

    it('unknown arg on overridden standard directive', () => {
      expectSDLErrors(`
        type Query {
          foo: String @deprecated(reason: "")
        }
        directive @deprecated(arg: String) on FIELD
      `).to.deep.equal([
        unknownDirectiveArg('reason', 'deprecated', [], 3, 35),
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
      ).to.deep.equal([unknownDirectiveArg('unknown', 'test', [], 4, 36)]);
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
      ).to.deep.equal([unknownDirectiveArg('unknown', 'test', [], 2, 35)]);
    });
  });
});
