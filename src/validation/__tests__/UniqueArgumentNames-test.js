// @flow strict

import { describe, it } from 'mocha';

import { UniqueArgumentNames } from '../rules/UniqueArgumentNames';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr) {
  return expectValidationErrors(UniqueArgumentNames, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

describe('Validate: Unique argument names', () => {
  it('no arguments on field', () => {
    expectValid(`
      {
        field
      }
    `);
  });

  it('no arguments on directive', () => {
    expectValid(`
      {
        field @directive
      }
    `);
  });

  it('argument on field', () => {
    expectValid(`
      {
        field(arg: "value")
      }
    `);
  });

  it('argument on directive', () => {
    expectValid(`
      {
        field @directive(arg: "value")
      }
    `);
  });

  it('same argument on two fields', () => {
    expectValid(`
      {
        one: field(arg: "value")
        two: field(arg: "value")
      }
    `);
  });

  it('same argument on field and directive', () => {
    expectValid(`
      {
        field(arg: "value") @directive(arg: "value")
      }
    `);
  });

  it('same argument on two directives', () => {
    expectValid(`
      {
        field @directive1(arg: "value") @directive2(arg: "value")
      }
    `);
  });

  it('multiple field arguments', () => {
    expectValid(`
      {
        field(arg1: "value", arg2: "value", arg3: "value")
      }
    `);
  });

  it('multiple directive arguments', () => {
    expectValid(`
      {
        field @directive(arg1: "value", arg2: "value", arg3: "value")
      }
    `);
  });

  it('duplicate field arguments', () => {
    expectErrors(`
      {
        field(arg1: "value", arg1: "value")
      }
    `).to.deep.equal([
      {
        message: 'There can be only one argument named "arg1".',
        locations: [{ line: 3, column: 15 }, { line: 3, column: 30 }],
      },
    ]);
  });

  it('many duplicate field arguments', () => {
    expectErrors(`
      {
        field(arg1: "value", arg1: "value", arg1: "value")
      }
    `).to.deep.equal([
      {
        message: 'There can be only one argument named "arg1".',
        locations: [{ line: 3, column: 15 }, { line: 3, column: 30 }],
      },
      {
        message: 'There can be only one argument named "arg1".',
        locations: [{ line: 3, column: 15 }, { line: 3, column: 45 }],
      },
    ]);
  });

  it('duplicate directive arguments', () => {
    expectErrors(`
      {
        field @directive(arg1: "value", arg1: "value")
      }
    `).to.deep.equal([
      {
        message: 'There can be only one argument named "arg1".',
        locations: [{ line: 3, column: 26 }, { line: 3, column: 41 }],
      },
    ]);
  });

  it('many duplicate directive arguments', () => {
    expectErrors(`
      {
        field @directive(arg1: "value", arg1: "value", arg1: "value")
      }
    `).to.deep.equal([
      {
        message: 'There can be only one argument named "arg1".',
        locations: [{ line: 3, column: 26 }, { line: 3, column: 41 }],
      },
      {
        message: 'There can be only one argument named "arg1".',
        locations: [{ line: 3, column: 26 }, { line: 3, column: 56 }],
      },
    ]);
  });
});
