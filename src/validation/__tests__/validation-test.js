/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { testSchema } from './harness';
import { validate, specifiedRules } from '../';
import { parse } from '../../language';
import { TypeInfo } from '../../utilities/TypeInfo';


function expectValid(schema, queryString) {
  const errors = validate(schema, parse(queryString));
  expect(errors).to.deep.equal([], 'Should validate');
}

describe('Validate: Supports full validation', () => {

  it('validates queries', () => {
    expectValid(testSchema, `
      query {
        catOrDog {
          ... on Cat {
            furColor
          }
          ... on Dog {
            isHousetrained
          }
        }
      }
    `);
  });

  // NOTE: experimental
  it('validates using a custom TypeInfo', () => {

    // This TypeInfo will never return a valid field.
    const typeInfo = new TypeInfo(testSchema, () => null);

    const ast = parse(`
      query {
        catOrDog {
          ... on Cat {
            furColor
          }
          ... on Dog {
            isHousetrained
          }
        }
      }
    `);

    const errors = validate(testSchema, ast, specifiedRules, typeInfo);

    const errorMessages = errors.map(err => err.message);

    expect(errorMessages).to.deep.equal([
      'Cannot query field "catOrDog" on type "QueryRoot". ' +
      'Did you mean "catOrDog"?',
      'Cannot query field "furColor" on type "Cat". ' +
      'Did you mean "furColor"?',
      'Cannot query field "isHousetrained" on type "Dog". ' +
      'Did you mean "isHousetrained"?'
    ]);
  });

});
