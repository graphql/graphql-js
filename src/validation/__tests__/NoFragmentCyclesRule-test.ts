import { describe, it } from 'mocha';

import { NoFragmentCyclesRule } from '../rules/NoFragmentCyclesRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(NoFragmentCyclesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: No circular fragment spreads', () => {
  it('single reference is valid', () => {
    expectValid(`
      fragment fragA on Dog { ...fragB }
      fragment fragB on Dog { name }
    `);
  });

  it('spreading twice is not circular', () => {
    expectValid(`
      fragment fragA on Dog { ...fragB, ...fragB }
      fragment fragB on Dog { name }
    `);
  });

  it('spreading twice indirectly is not circular', () => {
    expectValid(`
      fragment fragA on Dog { ...fragB, ...fragC }
      fragment fragB on Dog { ...fragC }
      fragment fragC on Dog { name }
    `);
  });

  it('double spread within abstract types', () => {
    expectValid(`
      fragment nameFragment on Pet {
        ... on Dog { name }
        ... on Cat { name }
      }

      fragment spreadsInAnon on Pet {
        ... on Dog { ...nameFragment }
        ... on Cat { ...nameFragment }
      }
    `);
  });

  it('does not false positive on unknown fragment', () => {
    expectValid(`
      fragment nameFragment on Pet {
        ...UnknownFragment
      }
    `);
  });

  it('spreading recursively within field fails', () => {
    expectErrors(`
      fragment fragA on Human { relatives { ...fragA } },
    `).toDeepEqual([
      {
        message: 'Cannot spread fragment "fragA" within itself.',
        locations: [{ line: 2, column: 45 }],
      },
    ]);
  });

  it('no spreading itself directly', () => {
    expectErrors(`
      fragment fragA on Dog { ...fragA }
    `).toDeepEqual([
      {
        message: 'Cannot spread fragment "fragA" within itself.',
        locations: [{ line: 2, column: 31 }],
      },
    ]);
  });

  it('no spreading itself directly within inline fragment', () => {
    expectErrors(`
      fragment fragA on Pet {
        ... on Dog {
          ...fragA
        }
      }
    `).toDeepEqual([
      {
        message: 'Cannot spread fragment "fragA" within itself.',
        locations: [{ line: 4, column: 11 }],
      },
    ]);
  });

  it('no spreading itself indirectly', () => {
    expectErrors(`
      fragment fragA on Dog { ...fragB }
      fragment fragB on Dog { ...fragA }
    `).toDeepEqual([
      {
        message: 'Cannot spread fragment "fragA" within itself via "fragB".',
        locations: [
          { line: 2, column: 31 },
          { line: 3, column: 31 },
        ],
      },
    ]);
  });

  it('no spreading itself indirectly reports opposite order', () => {
    expectErrors(`
      fragment fragB on Dog { ...fragA }
      fragment fragA on Dog { ...fragB }
    `).toDeepEqual([
      {
        message: 'Cannot spread fragment "fragB" within itself via "fragA".',
        locations: [
          { line: 2, column: 31 },
          { line: 3, column: 31 },
        ],
      },
    ]);
  });

  it('no spreading itself indirectly within inline fragment', () => {
    expectErrors(`
      fragment fragA on Pet {
        ... on Dog {
          ...fragB
        }
      }
      fragment fragB on Pet {
        ... on Dog {
          ...fragA
        }
      }
    `).toDeepEqual([
      {
        message: 'Cannot spread fragment "fragA" within itself via "fragB".',
        locations: [
          { line: 4, column: 11 },
          { line: 9, column: 11 },
        ],
      },
    ]);
  });

  it('no spreading itself deeply', () => {
    expectErrors(`
      fragment fragA on Dog { ...fragB }
      fragment fragB on Dog { ...fragC }
      fragment fragC on Dog { ...fragO }
      fragment fragX on Dog { ...fragY }
      fragment fragY on Dog { ...fragZ }
      fragment fragZ on Dog { ...fragO }
      fragment fragO on Dog { ...fragP }
      fragment fragP on Dog { ...fragA, ...fragX }
    `).toDeepEqual([
      {
        message:
          'Cannot spread fragment "fragA" within itself via "fragB", "fragC", "fragO", "fragP".',
        locations: [
          { line: 2, column: 31 },
          { line: 3, column: 31 },
          { line: 4, column: 31 },
          { line: 8, column: 31 },
          { line: 9, column: 31 },
        ],
      },
      {
        message:
          'Cannot spread fragment "fragO" within itself via "fragP", "fragX", "fragY", "fragZ".',
        locations: [
          { line: 8, column: 31 },
          { line: 9, column: 41 },
          { line: 5, column: 31 },
          { line: 6, column: 31 },
          { line: 7, column: 31 },
        ],
      },
    ]);
  });

  it('no spreading itself deeply two paths', () => {
    expectErrors(`
      fragment fragA on Dog { ...fragB, ...fragC }
      fragment fragB on Dog { ...fragA }
      fragment fragC on Dog { ...fragA }
    `).toDeepEqual([
      {
        message: 'Cannot spread fragment "fragA" within itself via "fragB".',
        locations: [
          { line: 2, column: 31 },
          { line: 3, column: 31 },
        ],
      },
      {
        message: 'Cannot spread fragment "fragA" within itself via "fragC".',
        locations: [
          { line: 2, column: 41 },
          { line: 4, column: 31 },
        ],
      },
    ]);
  });

  it('no spreading itself deeply two paths -- alt traverse order', () => {
    expectErrors(`
      fragment fragA on Dog { ...fragC }
      fragment fragB on Dog { ...fragC }
      fragment fragC on Dog { ...fragA, ...fragB }
    `).toDeepEqual([
      {
        message: 'Cannot spread fragment "fragA" within itself via "fragC".',
        locations: [
          { line: 2, column: 31 },
          { line: 4, column: 31 },
        ],
      },
      {
        message: 'Cannot spread fragment "fragC" within itself via "fragB".',
        locations: [
          { line: 4, column: 41 },
          { line: 3, column: 31 },
        ],
      },
    ]);
  });

  it('no spreading itself deeply and immediately', () => {
    expectErrors(`
      fragment fragA on Dog { ...fragB }
      fragment fragB on Dog { ...fragB, ...fragC }
      fragment fragC on Dog { ...fragA, ...fragB }
    `).toDeepEqual([
      {
        message: 'Cannot spread fragment "fragB" within itself.',
        locations: [{ line: 3, column: 31 }],
      },
      {
        message:
          'Cannot spread fragment "fragA" within itself via "fragB", "fragC".',
        locations: [
          { line: 2, column: 31 },
          { line: 3, column: 41 },
          { line: 4, column: 31 },
        ],
      },
      {
        message: 'Cannot spread fragment "fragB" within itself via "fragC".',
        locations: [
          { line: 3, column: 41 },
          { line: 4, column: 41 },
        ],
      },
    ]);
  });
});
