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
import NoFragmentCycles from '../rules/NoFragmentCycles';
import { cycleErrorMessage } from '../errors';

describe('Validate: No circular fragment spreads', () => {

  it('single reference is valid', () => {
    expectPassesRule(NoFragmentCycles, `
      fragment fragA on Dog { ...fragB }
      fragment fragB on Dog { name }
    `);
  });

  it('spreading twice is not circular', () => {
    expectPassesRule(NoFragmentCycles, `
      fragment fragA on Dog { ...fragB, ...fragB }
      fragment fragB on Dog { name }
    `);
  });

  it('spreading twice indirectly is not circular', () => {
    expectPassesRule(NoFragmentCycles, `
      fragment fragA on Dog { ...fragB, ...fragC }
      fragment fragB on Dog { ...fragC }
      fragment fragC on Dog { name }
    `);
  });

  it('double spread within abstract types', () => {
    expectPassesRule(NoFragmentCycles, `
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

  it('spreading recursively within field fails', () => {
    expectFailsRule(NoFragmentCycles, `
      fragment fragA on Human { relatives { ...fragA } },
    `, [
      { message: cycleErrorMessage('fragA', []),
        locations: [ { line: 2, column: 45 } ] }
    ]);
  });

  it('no spreading itself directly', () => {
    expectFailsRule(NoFragmentCycles, `
      fragment fragA on Dog { ...fragA }
    `, [
      { message: cycleErrorMessage('fragA', []),
        locations: [ { line: 2, column: 31 } ] }
    ]);
  });

  it('no spreading itself directly within inline fragment', () => {
    expectFailsRule(NoFragmentCycles, `
      fragment fragA on Pet {
        ... on Dog {
          ...fragA
        }
      }
    `, [
      { message: cycleErrorMessage('fragA', []),
        locations: [ { line: 4, column: 11 } ] }
    ]);
  });

  it('no spreading itself indirectly', () => {
    expectFailsRule(NoFragmentCycles, `
      fragment fragA on Dog { ...fragB }
      fragment fragB on Dog { ...fragA }
    `, [
      { message: cycleErrorMessage('fragA', ['fragB']),
        locations: [ { line: 2, column: 31 }, { line: 3, column: 31 } ] }
    ]);
  });

  it('no spreading itself indirectly reports opposite order', () => {
    expectFailsRule(NoFragmentCycles, `
      fragment fragB on Dog { ...fragA }
      fragment fragA on Dog { ...fragB }
    `, [
      { message: cycleErrorMessage('fragB', ['fragA']),
        locations: [ { line: 2, column: 31 }, { line: 3, column: 31 } ] }
    ]);
  });


  it('no spreading itself indirectly within inline fragment', () => {
    expectFailsRule(NoFragmentCycles, `
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
    `, [
      { message: cycleErrorMessage('fragA', ['fragB']),
        locations: [ { line: 4, column: 11 }, { line: 9, column: 11 } ] }
    ]);
  });

  it('no spreading itself deeply', () => {
    expectFailsRule(NoFragmentCycles, `
      fragment fragA on Dog { ...fragB }
      fragment fragB on Dog { ...fragC }
      fragment fragC on Dog { ...fragO }
      fragment fragX on Dog { ...fragY }
      fragment fragY on Dog { ...fragZ }
      fragment fragZ on Dog { ...fragO }
      fragment fragO on Dog { ...fragA, ...fragX }
    `, [
      { message: cycleErrorMessage('fragA', ['fragB', 'fragC', 'fragO']),
        locations:
         [ { line: 2, column: 31 },
           { line: 3, column: 31 },
           { line: 4, column: 31 },
           { line: 8, column: 31 } ] },
      { message: cycleErrorMessage('fragX', ['fragY', 'fragZ', 'fragO']),
        locations:
         [
           { line: 5, column: 31 },
           { line: 6, column: 31 },
           { line: 7, column: 31 },
           { line: 8, column: 41 },
        ] }
    ]);
  });

  it('no spreading itself deeply two paths -- new rule', () => {
    expectFailsRule(NoFragmentCycles, `
      fragment fragA on Dog { ...fragB, ...fragC }
      fragment fragB on Dog { ...fragA }
      fragment fragC on Dog { ...fragA }
    `, [
      { message: cycleErrorMessage('fragA', ['fragB']),
        locations: [ { line: 2, column: 31 }, { line: 3, column: 31 } ] },
      { message: cycleErrorMessage('fragA', ['fragC']),
        locations: [ { line: 2, column: 41 }, { line: 4, column: 31 } ] }
    ]);
  });

});
