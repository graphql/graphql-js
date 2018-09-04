/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { buildSchema } from '../../utilities';
import {
  expectPassesRule,
  expectFailsRule,
  expectSDLErrorsFromRule,
} from './harness';
import {
  KnownArgumentNames,
  KnownArgumentNamesOnDirectives,
  unknownArgMessage,
  unknownDirectiveArgMessage,
} from '../rules/KnownArgumentNames';

const expectSDLErrors = expectSDLErrorsFromRule.bind(
  undefined,
  KnownArgumentNamesOnDirectives,
);

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
    expectPassesRule(
      KnownArgumentNames,
      `
      fragment argOnRequiredArg on Dog {
        doesKnowCommand(dogCommand: SIT)
      }
    `,
    );
  });

  it('multiple args are known', () => {
    expectPassesRule(
      KnownArgumentNames,
      `
      fragment multipleArgs on ComplicatedArgs {
        multipleReqs(req1: 1, req2: 2)
      }
    `,
    );
  });

  it('ignores args of unknown fields', () => {
    expectPassesRule(
      KnownArgumentNames,
      `
      fragment argOnUnknownField on Dog {
        unknownField(unknownArg: SIT)
      }
    `,
    );
  });

  it('multiple args in reverse order are known', () => {
    expectPassesRule(
      KnownArgumentNames,
      `
      fragment multipleArgsReverseOrder on ComplicatedArgs {
        multipleReqs(req2: 2, req1: 1)
      }
    `,
    );
  });

  it('no args on optional arg', () => {
    expectPassesRule(
      KnownArgumentNames,
      `
      fragment noArgOnOptionalArg on Dog {
        isHousetrained
      }
    `,
    );
  });

  it('args are known deeply', () => {
    expectPassesRule(
      KnownArgumentNames,
      `
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
    `,
    );
  });

  it('directive args are known', () => {
    expectPassesRule(
      KnownArgumentNames,
      `
      {
        dog @skip(if: true)
      }
    `,
    );
  });

  it('undirective args are invalid', () => {
    expectFailsRule(
      KnownArgumentNames,
      `
      {
        dog @skip(unless: true)
      }
    `,
      [unknownDirectiveArg('unless', 'skip', [], 3, 19)],
    );
  });

  it('misspelled directive args are reported', () => {
    expectFailsRule(
      KnownArgumentNames,
      `
      {
        dog @skip(iff: true)
      }
    `,
      [unknownDirectiveArg('iff', 'skip', ['if'], 3, 19)],
    );
  });

  it('invalid arg name', () => {
    expectFailsRule(
      KnownArgumentNames,
      `
      fragment invalidArgName on Dog {
        doesKnowCommand(unknown: true)
      }
    `,
      [unknownArg('unknown', 'doesKnowCommand', 'Dog', [], 3, 25)],
    );
  });

  it('misspelled arg name is reported', () => {
    expectFailsRule(
      KnownArgumentNames,
      `
      fragment invalidArgName on Dog {
        doesKnowCommand(dogcommand: true)
      }
    `,
      [
        unknownArg(
          'dogcommand',
          'doesKnowCommand',
          'Dog',
          ['dogCommand'],
          3,
          25,
        ),
      ],
    );
  });

  it('unknown args amongst known args', () => {
    expectFailsRule(
      KnownArgumentNames,
      `
      fragment oneGoodArgOneInvalidArg on Dog {
        doesKnowCommand(whoknows: 1, dogCommand: SIT, unknown: true)
      }
    `,
      [
        unknownArg('whoknows', 'doesKnowCommand', 'Dog', [], 3, 25),
        unknownArg('unknown', 'doesKnowCommand', 'Dog', [], 3, 55),
      ],
    );
  });

  it('unknown args deeply', () => {
    expectFailsRule(
      KnownArgumentNames,
      `
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
    `,
      [
        unknownArg('unknown', 'doesKnowCommand', 'Dog', [], 4, 27),
        unknownArg('unknown', 'doesKnowCommand', 'Dog', [], 9, 31),
      ],
    );
  });

  describe('within SDL', () => {
    it('known arg on directive defined inside SDL', () => {
      expectSDLErrors(`
        type Query {
          foo: String @test(arg: "")
        }

        directive @test(arg: String) on FIELD_DEFINITION
      `).to.deep.equal([]);
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
