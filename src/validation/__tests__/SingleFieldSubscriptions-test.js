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
  SingleFieldSubscriptions,
  singleFieldOnlyMessage,
} from '../rules/SingleFieldSubscriptions';


describe('Validate: Subscriptions with single field', () => {

  it('valid subscription', () => {
    expectPassesRule(SingleFieldSubscriptions, `
      subscription ImportantEmails {
        importantEmails
      }
    `);
  });

  it('fails with more than one root field', () => {
    expectFailsRule(SingleFieldSubscriptions, `
      subscription ImportantEmails {
        importantEmails
        notImportantEmails
      }
    `, [ {
      message: singleFieldOnlyMessage('ImportantEmails'),
      locations: [ { line: 4, column: 9 } ],
      path: undefined,
    } ]);
  });

  it('fails with more than one root field including introspection', () => {
    expectFailsRule(SingleFieldSubscriptions, `
      subscription ImportantEmails {
        importantEmails
        __typename
      }
    `, [ {
      message: singleFieldOnlyMessage('ImportantEmails'),
      locations: [ { line: 4, column: 9 } ],
      path: undefined,
    } ]);
  });

  it('fails with many more than one root field', () => {
    expectFailsRule(SingleFieldSubscriptions, `
      subscription ImportantEmails {
        importantEmails
        notImportantEmails
        spamEmails
      }
    `, [ {
      message: singleFieldOnlyMessage('ImportantEmails'),
      locations: [ { line: 4, column: 9 }, { line: 5, column: 9 } ],
      path: undefined,
    } ]);
  });

  it('fails with more than one root field in anonymous subscriptions', () => {
    expectFailsRule(SingleFieldSubscriptions, `
      subscription {
        importantEmails
        notImportantEmails
      }
    `, [ {
      message: singleFieldOnlyMessage(null),
      locations: [ { line: 4, column: 9 } ],
      path: undefined,
    } ]);
  });

});
