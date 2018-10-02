/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  LoneAnonymousOperation,
  anonOperationNotAloneMessage,
} from '../rules/LoneAnonymousOperation';

function anonNotAlone(line, column) {
  return {
    message: anonOperationNotAloneMessage(),
    locations: [{ line, column }],
  };
}

describe('Validate: Anonymous operation must be alone', () => {
  it('no operations', () => {
    expectPassesRule(
      LoneAnonymousOperation,
      `
      fragment fragA on Type {
        field
      }
    `,
    );
  });

  it('one anon operation', () => {
    expectPassesRule(
      LoneAnonymousOperation,
      `
      {
        field
      }
    `,
    );
  });

  it('multiple named operations', () => {
    expectPassesRule(
      LoneAnonymousOperation,
      `
      query Foo {
        field
      }

      query Bar {
        field
      }
    `,
    );
  });

  it('anon operation with fragment', () => {
    expectPassesRule(
      LoneAnonymousOperation,
      `
      {
        ...Foo
      }
      fragment Foo on Type {
        field
      }
    `,
    );
  });

  it('multiple anon operations', () => {
    expectFailsRule(
      LoneAnonymousOperation,
      `
      {
        fieldA
      }
      {
        fieldB
      }
    `,
      [anonNotAlone(2, 7), anonNotAlone(5, 7)],
    );
  });

  it('anon operation with a mutation', () => {
    expectFailsRule(
      LoneAnonymousOperation,
      `
      {
        fieldA
      }
      mutation Foo {
        fieldB
      }
    `,
      [anonNotAlone(2, 7)],
    );
  });

  it('anon operation with a subscription', () => {
    expectFailsRule(
      LoneAnonymousOperation,
      `
      {
        fieldA
      }
      subscription Foo {
        fieldB
      }
    `,
      [anonNotAlone(2, 7)],
    );
  });
});
