/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  ProvidedRequiredArguments,
  missingFieldArgMessage,
  missingDirectiveArgMessage,
} from '../rules/ProvidedRequiredArguments';

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
    expectPassesRule(
      ProvidedRequiredArguments,
      `
      {
        dog {
          isHousetrained(unknownArgument: true)
        }
      }
    `,
    );
  });

  describe('Valid non-nullable value', () => {
    it('Arg on optional arg', () => {
      expectPassesRule(
        ProvidedRequiredArguments,
        `
        {
          dog {
            isHousetrained(atOtherHomes: true)
          }
        }
      `,
      );
    });

    it('No Arg on optional arg', () => {
      expectPassesRule(
        ProvidedRequiredArguments,
        `
        {
          dog {
            isHousetrained
          }
        }
      `,
      );
    });

    it('No arg on non-null field with default', () => {
      expectPassesRule(
        ProvidedRequiredArguments,
        `
        {
          complicatedArgs {
            nonNullFieldWithDefault
          }
        }
      `,
      );
    });

    it('Multiple args', () => {
      expectPassesRule(
        ProvidedRequiredArguments,
        `
        {
          complicatedArgs {
            multipleReqs(req1: 1, req2: 2)
          }
        }
      `,
      );
    });

    it('Multiple args reverse order', () => {
      expectPassesRule(
        ProvidedRequiredArguments,
        `
        {
          complicatedArgs {
            multipleReqs(req2: 2, req1: 1)
          }
        }
      `,
      );
    });

    it('No args on multiple optional', () => {
      expectPassesRule(
        ProvidedRequiredArguments,
        `
        {
          complicatedArgs {
            multipleOpts
          }
        }
      `,
      );
    });

    it('One arg on multiple optional', () => {
      expectPassesRule(
        ProvidedRequiredArguments,
        `
        {
          complicatedArgs {
            multipleOpts(opt1: 1)
          }
        }
      `,
      );
    });

    it('Second arg on multiple optional', () => {
      expectPassesRule(
        ProvidedRequiredArguments,
        `
        {
          complicatedArgs {
            multipleOpts(opt2: 1)
          }
        }
      `,
      );
    });

    it('Multiple reqs on mixedList', () => {
      expectPassesRule(
        ProvidedRequiredArguments,
        `
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4)
          }
        }
      `,
      );
    });

    it('Multiple reqs and one opt on mixedList', () => {
      expectPassesRule(
        ProvidedRequiredArguments,
        `
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4, opt1: 5)
          }
        }
      `,
      );
    });

    it('All reqs and opts on mixedList', () => {
      expectPassesRule(
        ProvidedRequiredArguments,
        `
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4, opt1: 5, opt2: 6)
          }
        }
      `,
      );
    });
  });

  describe('Invalid non-nullable value', () => {
    it('Missing one non-nullable argument', () => {
      expectFailsRule(
        ProvidedRequiredArguments,
        `
        {
          complicatedArgs {
            multipleReqs(req2: 2)
          }
        }
      `,
        [missingFieldArg('multipleReqs', 'req1', 'Int!', 4, 13)],
      );
    });

    it('Missing multiple non-nullable arguments', () => {
      expectFailsRule(
        ProvidedRequiredArguments,
        `
        {
          complicatedArgs {
            multipleReqs
          }
        }
      `,
        [
          missingFieldArg('multipleReqs', 'req1', 'Int!', 4, 13),
          missingFieldArg('multipleReqs', 'req2', 'Int!', 4, 13),
        ],
      );
    });

    it('Incorrect value and missing argument', () => {
      expectFailsRule(
        ProvidedRequiredArguments,
        `
        {
          complicatedArgs {
            multipleReqs(req1: "one")
          }
        }
      `,
        [missingFieldArg('multipleReqs', 'req2', 'Int!', 4, 13)],
      );
    });
  });

  describe('Directive arguments', () => {
    it('ignores unknown directives', () => {
      expectPassesRule(
        ProvidedRequiredArguments,
        `
        {
          dog @unknown
        }
      `,
      );
    });

    it('with directives of valid types', () => {
      expectPassesRule(
        ProvidedRequiredArguments,
        `
        {
          dog @include(if: true) {
            name
          }
          human @skip(if: false) {
            name
          }
        }
      `,
      );
    });

    it('with directive with missing types', () => {
      expectFailsRule(
        ProvidedRequiredArguments,
        `
        {
          dog @include {
            name @skip
          }
        }
      `,
        [
          missingDirectiveArg('include', 'if', 'Boolean!', 3, 15),
          missingDirectiveArg('skip', 'if', 'Boolean!', 4, 18),
        ],
      );
    });
  });
});
