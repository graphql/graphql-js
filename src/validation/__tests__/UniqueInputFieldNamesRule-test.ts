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

  it('allow and/or with duplicate fields in array', () => {
    expectValid(`
      {
        field(arg: { and: [{ f: true }, { f: true }] })
      }
    `);
    expectValid(`
      {
        field(arg: { or: [{ f: true }, { f: {f1: true} }] })
      }
    `);
    expectValid(`
      {
        field(arg: { or: [{ f: true }, { f1: {f: true} }] })
      }
    `);
  });

  it('duplicate input object fields in objects of array', () => {
    expectErrors(`
      {
        field(arg: { or: [{ f: true, f: true }] })
      }
    `).toDeepEqual([
      {
        message: 'There can be only one input field named "f".',
        locations: [
          { line: 3, column: 29 },
          { line: 3, column: 38 },
        ],
      },
    ]);
  });

  it('nested input object fields in objects of array', () => {
    expectErrors(`
      {
        field(arg: { or: [{f2: true}, { f1: {f2: "value", f2: "value" }}] })
      }
    `).toDeepEqual([
      {
        message: 'There can be only one input field named "f2".',
        locations: [
          { line: 3, column: 46 },
          { line: 3, column: 59 },
        ],
      },
    ]);
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
