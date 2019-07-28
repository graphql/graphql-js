// @flow strict

import { describe, it } from 'mocha';

import {
  LoneAnonymousOperation,
  anonOperationNotAloneMessage,
} from '../rules/LoneAnonymousOperation';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr) {
  return expectValidationErrors(LoneAnonymousOperation, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function anonOperationNotAlone(line, column) {
  return {
    message: anonOperationNotAloneMessage(),
    locations: [{ line, column }],
  };
}

describe('Validate: Anonymous operation must be alone', () => {
  it('no operations', () => {
    expectValid(`
      fragment fragA on Type {
        field
      }
    `);
  });

  it('one anon operation', () => {
    expectValid(`
      {
        field
      }
    `);
  });

  it('multiple named operations', () => {
    expectValid(`
      query Foo {
        field
      }

      query Bar {
        field
      }
    `);
  });

  it('anon operation with fragment', () => {
    expectValid(`
      {
        ...Foo
      }
      fragment Foo on Type {
        field
      }
    `);
  });

  it('multiple anon operations', () => {
    expectErrors(`
      {
        fieldA
      }
      {
        fieldB
      }
    `).to.deep.equal([
      anonOperationNotAlone(2, 7),
      anonOperationNotAlone(5, 7),
    ]);
  });

  it('anon operation with a mutation', () => {
    expectErrors(`
      {
        fieldA
      }
      mutation Foo {
        fieldB
      }
    `).to.deep.equal([anonOperationNotAlone(2, 7)]);
  });

  it('anon operation with a subscription', () => {
    expectErrors(`
      {
        fieldA
      }
      subscription Foo {
        fieldB
      }
    `).to.deep.equal([anonOperationNotAlone(2, 7)]);
  });
});
