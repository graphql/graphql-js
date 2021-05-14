import { describe, it } from 'mocha';

import { UniqueOperationNamesRule } from '../rules/UniqueOperationNamesRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(UniqueOperationNamesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).to.deep.equal([]);
}

describe('Validate: Unique operation names', () => {
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

  it('one named operation', () => {
    expectValid(`
      query Foo {
        field
      }
    `);
  });

  it('multiple operations', () => {
    expectValid(`
      query Foo {
        field
      }

      query Bar {
        field
      }
    `);
  });

  it('multiple operations of different types', () => {
    expectValid(`
      query Foo {
        field
      }

      mutation Bar {
        field
      }

      subscription Baz {
        field
      }
    `);
  });

  it('fragment and operation named the same', () => {
    expectValid(`
      query Foo {
        ...Foo
      }
      fragment Foo on Type {
        field
      }
    `);
  });

  it('multiple operations of same name', () => {
    expectErrors(`
      query Foo {
        fieldA
      }
      query Foo {
        fieldB
      }
    `).to.deep.equal([
      {
        message: 'There can be only one operation named "Foo".',
        locations: [
          { line: 2, column: 13 },
          { line: 5, column: 13 },
        ],
      },
    ]);
  });

  it('multiple ops of same name of different types (mutation)', () => {
    expectErrors(`
      query Foo {
        fieldA
      }
      mutation Foo {
        fieldB
      }
    `).to.deep.equal([
      {
        message: 'There can be only one operation named "Foo".',
        locations: [
          { line: 2, column: 13 },
          { line: 5, column: 16 },
        ],
      },
    ]);
  });

  it('multiple ops of same name of different types (subscription)', () => {
    expectErrors(`
      query Foo {
        fieldA
      }
      subscription Foo {
        fieldB
      }
    `).to.deep.equal([
      {
        message: 'There can be only one operation named "Foo".',
        locations: [
          { line: 2, column: 13 },
          { line: 5, column: 20 },
        ],
      },
    ]);
  });
});
