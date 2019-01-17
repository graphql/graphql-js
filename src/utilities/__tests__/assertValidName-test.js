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
import { assertValidName } from '../assertValidName';

describe('assertValidName()', () => {
  it('throws for use of leading double underscores', () => {
    expect(() => assertValidName('__bad')).to.throw(
      '"__bad" must not begin with "__", which is reserved by GraphQL introspection.',
    );
  });

  it('throws for non-strings', () => {
    // $DisableFlowOnNegativeTest
    expect(() => assertValidName({})).to.throw(/Expected string/);
  });

  it('throws for names with invalid characters', () => {
    expect(() => assertValidName('>--()-->')).to.throw(/Names must match/);
  });
});
