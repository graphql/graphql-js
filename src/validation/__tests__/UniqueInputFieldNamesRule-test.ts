import { describe, it } from 'mocha';

import { UniqueInputFieldNamesRule } from '../rules/UniqueInputFieldNamesRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(UniqueInputFieldNamesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: Unique input field names', () => {
  it('input object with fields', () => {
    expectValid(`
      {
        field(arg: { f: true })
      }
    `);
  });

  it('same input object within two args', () => {
    expectValid(`
      {
        field(arg1: { f: true }, arg2: { f: true })
      }
    `);
  });

  it('multiple input object fields', () => {
    expectValid(`
      {
        field(arg: { f1: "value", f2: "value", f3: "value" })
      }
    `);
  });

  it('allows for nested input objects with similar fields', () => {
    expectValid(`
      {
        field(arg: {
          deep: {
            deep: {
              id: 1
            }
            id: 1
          }
          id: 1
        })
      }
    `);
  });

  it('duplicate input object fields', () => {
    expectErrors(`
      {
        field(arg: { f1: "value", f1: "value" })
      }
    `).toDeepEqual([
      {
        message: 'There can be only one input field named "f1".',
        locations: [
          { line: 3, column: 22 },
          { line: 3, column: 35 },
        ],
      },
    ]);
  });

  it('many duplicate input object fields', () => {
    expectErrors(`
      {
        field(arg: { f1: "value", f1: "value", f1: "value" })
      }
    `).toDeepEqual([
      {
        message: 'There can be only one input field named "f1".',
        locations: [
          { line: 3, column: 22 },
          { line: 3, column: 35 },
        ],
      },
      {
        message: 'There can be only one input field named "f1".',
        locations: [
          { line: 3, column: 22 },
          { line: 3, column: 48 },
        ],
      },
    ]);
  });

  it('nested duplicate input object fields', () => {
    expectErrors(`
      {
        field(arg: { f1: {f2: "value", f2: "value" }})
      }
    `).toDeepEqual([
      {
        message: 'There can be only one input field named "f2".',
        locations: [
          { line: 3, column: 27 },
          { line: 3, column: 40 },
        ],
      },
    ]);
  });
});
