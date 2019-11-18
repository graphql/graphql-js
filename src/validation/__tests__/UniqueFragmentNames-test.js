// @flow strict

import { describe, it } from 'mocha';

import { UniqueFragmentNames } from '../rules/UniqueFragmentNames';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr) {
  return expectValidationErrors(UniqueFragmentNames, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

describe('Validate: Unique fragment names', () => {
  it('no fragments', () => {
    expectValid(`
      {
        field
      }
    `);
  });

  it('one fragment', () => {
    expectValid(`
      {
        ...fragA
      }

      fragment fragA on Type {
        field
      }
    `);
  });

  it('many fragments', () => {
    expectValid(`
      {
        ...fragA
        ...fragB
        ...fragC
      }
      fragment fragA on Type {
        fieldA
      }
      fragment fragB on Type {
        fieldB
      }
      fragment fragC on Type {
        fieldC
      }
    `);
  });

  it('inline fragments are always unique', () => {
    expectValid(`
      {
        ...on Type {
          fieldA
        }
        ...on Type {
          fieldB
        }
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

  it('fragments named the same', () => {
    expectErrors(`
      {
        ...fragA
      }
      fragment fragA on Type {
        fieldA
      }
      fragment fragA on Type {
        fieldB
      }
    `).to.deep.equal([
      {
        message: 'There can be only one fragment named "fragA".',
        locations: [
          { line: 5, column: 16 },
          { line: 8, column: 16 },
        ],
      },
    ]);
  });

  it('fragments named the same without being referenced', () => {
    expectErrors(`
      fragment fragA on Type {
        fieldA
      }
      fragment fragA on Type {
        fieldB
      }
    `).to.deep.equal([
      {
        message: 'There can be only one fragment named "fragA".',
        locations: [
          { line: 2, column: 16 },
          { line: 5, column: 16 },
        ],
      },
    ]);
  });
});
