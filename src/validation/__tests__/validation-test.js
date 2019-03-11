/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { testSchema } from './harness';
import { validate, specifiedRules } from '../';
import { parse } from '../../language';
import { TypeInfo } from '../../utilities/TypeInfo';

describe('Validate: Supports full validation', () => {
  it('validates queries', () => {
    const doc = parse(`
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

    const errors = validate(testSchema, doc);
    expect(errors).to.deep.equal([]);
  });

  it('detects bad scalar parse', () => {
    const doc = parse(`
      query {
        invalidArg(arg: "bad value")
      }
    `);

    const errors = validate(testSchema, doc);
    expect(errors).to.deep.equal([
      {
        locations: [{ line: 3, column: 25 }],
        message:
          'Expected type Invalid, found "bad value"; Invalid scalar is always invalid: "bad value"',
      },
    ]);
  });

  // NOTE: experimental
  it('validates using a custom TypeInfo', () => {
    // This TypeInfo will never return a valid field.
    const typeInfo = new TypeInfo(testSchema, () => null);

    const doc = parse(`
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

    const errors = validate(testSchema, doc, specifiedRules, typeInfo);
    const errorMessages = errors.map(err => err.message);

    expect(errorMessages).to.deep.equal([
      'Cannot query field "catOrDog" on type "QueryRoot". Did you mean "catOrDog"?',
      'Cannot query field "furColor" on type "Cat". Did you mean "furColor"?',
      'Cannot query field "isHousetrained" on type "Dog". Did you mean "isHousetrained"?',
    ]);
  });
});
