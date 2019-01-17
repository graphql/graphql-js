/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expectValidationErrors } from './harness';
import {
  FragmentsOnCompositeTypes,
  inlineFragmentOnNonCompositeErrorMessage,
  fragmentOnNonCompositeErrorMessage,
} from '../rules/FragmentsOnCompositeTypes';

function expectErrors(queryStr) {
  return expectValidationErrors(FragmentsOnCompositeTypes, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function fragmentOnNonComposite(fragName, typeName, line, column) {
  return {
    message: fragmentOnNonCompositeErrorMessage(fragName, typeName),
    locations: [{ line, column }],
  };
}

describe('Validate: Fragments on composite types', () => {
  it('object is valid fragment type', () => {
    expectValid(`
      fragment validFragment on Dog {
        barks
      }
    `);
  });

  it('interface is valid fragment type', () => {
    expectValid(`
      fragment validFragment on Pet {
        name
      }
    `);
  });

  it('object is valid inline fragment type', () => {
    expectValid(`
      fragment validFragment on Pet {
        ... on Dog {
          barks
        }
      }
    `);
  });

  it('inline fragment without type is valid', () => {
    expectValid(`
      fragment validFragment on Pet {
        ... {
          name
        }
      }
    `);
  });

  it('union is valid fragment type', () => {
    expectValid(`
      fragment validFragment on CatOrDog {
        __typename
      }
    `);
  });

  it('scalar is invalid fragment type', () => {
    expectErrors(`
      fragment scalarFragment on Boolean {
        bad
      }
    `).to.deep.equal([
      fragmentOnNonComposite('scalarFragment', 'Boolean', 2, 34),
    ]);
  });

  it('enum is invalid fragment type', () => {
    expectErrors(`
      fragment scalarFragment on FurColor {
        bad
      }
    `).to.deep.equal([
      fragmentOnNonComposite('scalarFragment', 'FurColor', 2, 34),
    ]);
  });

  it('input object is invalid fragment type', () => {
    expectErrors(`
      fragment inputFragment on ComplexInput {
        stringField
      }
    `).to.deep.equal([
      fragmentOnNonComposite('inputFragment', 'ComplexInput', 2, 33),
    ]);
  });

  it('scalar is invalid inline fragment type', () => {
    expectErrors(`
      fragment invalidFragment on Pet {
        ... on String {
          barks
        }
      }
    `).to.deep.equal([
      {
        message: inlineFragmentOnNonCompositeErrorMessage('String'),
        locations: [{ line: 3, column: 16 }],
      },
    ]);
  });
});
