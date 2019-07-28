// @flow strict

import { describe, it } from 'mocha';

import {
  SingleFieldSubscriptions,
  singleFieldOnlyMessage,
} from '../rules/SingleFieldSubscriptions';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr) {
  return expectValidationErrors(SingleFieldSubscriptions, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

describe('Validate: Subscriptions with single field', () => {
  it('valid subscription', () => {
    expectValid(`
      subscription ImportantEmails {
        importantEmails
      }
    `);
  });

  it('fails with more than one root field', () => {
    expectErrors(`
      subscription ImportantEmails {
        importantEmails
        notImportantEmails
      }
    `).to.deep.equal([
      {
        message: singleFieldOnlyMessage('ImportantEmails'),
        locations: [{ line: 4, column: 9 }],
      },
    ]);
  });

  it('fails with more than one root field including introspection', () => {
    expectErrors(`
      subscription ImportantEmails {
        importantEmails
        __typename
      }
    `).to.deep.equal([
      {
        message: singleFieldOnlyMessage('ImportantEmails'),
        locations: [{ line: 4, column: 9 }],
      },
    ]);
  });

  it('fails with many more than one root field', () => {
    expectErrors(`
      subscription ImportantEmails {
        importantEmails
        notImportantEmails
        spamEmails
      }
    `).to.deep.equal([
      {
        message: singleFieldOnlyMessage('ImportantEmails'),
        locations: [{ line: 4, column: 9 }, { line: 5, column: 9 }],
      },
    ]);
  });

  it('fails with more than one root field in anonymous subscriptions', () => {
    expectErrors(`
      subscription {
        importantEmails
        notImportantEmails
      }
    `).to.deep.equal([
      {
        message: singleFieldOnlyMessage(null),
        locations: [{ line: 4, column: 9 }],
      },
    ]);
  });
});
