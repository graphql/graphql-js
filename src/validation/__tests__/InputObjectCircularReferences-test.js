/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  InputObjectCircularReferences,
  unbrokenCircularReferenceMessage,
} from '../rules/InputObjectCircularReferences';

function unbrokenCircularReference(defName, fieldName, line, column) {
  return {
    message: unbrokenCircularReferenceMessage(defName, fieldName),
    locations: [{ line, column }],
  };
}

describe('Validate: Executable definitions', () => {
  it('Allow simple input object with nullable circular reference', () => {
    expectPassesRule(
      InputObjectCircularReferences,
      `
      input Example {
        self: Example
        value: String
      }
    `,
    );
  });

  it('Allow input object with circular reference broken up by a list', () => {
    expectPassesRule(
      InputObjectCircularReferences,
      `
      input Example {
        self: [Example!]!
        value: String
      }
    `,
    );
  });

  it('Reject simple input object with non-nullable circular reference', () => {
    expectFailsRule(
      InputObjectCircularReferences,
      `
      input Example {
        value: String
        self: Example!
      }
    `,
      [unbrokenCircularReference('Example', 'self', 3, 8)],
    );
  });

  it('Reject input object with non-nullable circular reference spread across multiple inputs', () => {
    expectFailsRule(
      InputObjectCircularReferences,
      `
      input First {
        second: Second!
        value: String
      }
      
      input Second {
        first: First!
        value: String
      }
    `,
      [
        unbrokenCircularReference('First', 'second', 3, 8),
        unbrokenCircularReference('Second', 'first', 8, 8),
      ],
    );
  });
});
