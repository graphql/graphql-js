/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  KnownArgumentNames,
  unknownArgMessage,
  unknownDirectiveArgMessage,
} from '../rules/KnownArgumentNames';


function unknownArg(argName, fieldName, typeName, suggestedArgs, line, column) {
  return {
    message: unknownArgMessage(argName, fieldName, typeName, suggestedArgs),
    locations: [ { line, column } ],
  };
}

function unknownDirectiveArg(
  argName,
  directiveName,
  suggestedArgs,
  line,
  column
) {
  return {
    message: unknownDirectiveArgMessage(argName, directiveName, suggestedArgs),
    locations: [ { line, column } ],
  };
}

describe('Validate: Known argument names', () => {

  it('single arg is known', () => {
    expectPassesRule(KnownArgumentNames, `
      fragment argOnRequiredArg on Dog {
        doesKnowCommand(dogCommand: SIT)
      }
    `);
  });

  it('multiple args are known', () => {
    expectPassesRule(KnownArgumentNames, `
      fragment multipleArgs on ComplicatedArgs {
        multipleReqs(req1: 1, req2: 2)
      }
    `);
  });

  it('ignores args of unknown fields', () => {
    expectPassesRule(KnownArgumentNames, `
      fragment argOnUnknownField on Dog {
        unknownField(unknownArg: SIT)
      }
    `);
  });

  it('multiple args in reverse order are known', () => {
    expectPassesRule(KnownArgumentNames, `
      fragment multipleArgsReverseOrder on ComplicatedArgs {
        multipleReqs(req2: 2, req1: 1)
      }
    `);
  });

  it('no args on optional arg', () => {
    expectPassesRule(KnownArgumentNames, `
      fragment noArgOnOptionalArg on Dog {
        isHousetrained
      }
    `);
  });

  it('args are known deeply', () => {
    expectPassesRule(KnownArgumentNames, `
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
    expectPassesRule(KnownArgumentNames, `
      {
        dog @skip(if: true)
      }
    `);
  });

  it('undirective args are invalid', () => {
    expectFailsRule(KnownArgumentNames, `
      {
        dog @skip(unless: true)
      }
    `, [
      unknownDirectiveArg('unless', 'skip', [], 3, 19),
    ]);
  });

  it('invalid arg name', () => {
    expectFailsRule(KnownArgumentNames, `
      fragment invalidArgName on Dog {
        doesKnowCommand(unknown: true)
      }
    `, [
      unknownArg('unknown', 'doesKnowCommand', 'Dog', [], 3, 25),
    ]);
  });

  it('unknown args amongst known args', () => {
    expectFailsRule(KnownArgumentNames, `
      fragment oneGoodArgOneInvalidArg on Dog {
        doesKnowCommand(whoknows: 1, dogCommand: SIT, unknown: true)
      }
    `, [
      unknownArg('whoknows', 'doesKnowCommand', 'Dog', [], 3, 25),
      unknownArg('unknown', 'doesKnowCommand', 'Dog', [], 3, 55),
    ]);
  });

  it('unknown args deeply', () => {
    expectFailsRule(KnownArgumentNames, `
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
    `, [
      unknownArg('unknown', 'doesKnowCommand', 'Dog', [], 4, 27),
      unknownArg('unknown', 'doesKnowCommand', 'Dog', [], 9, 31),
    ]);
  });

});
