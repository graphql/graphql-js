/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import identityFunc from '../identityFunc';

describe('identityFunc', () => {
  it('returns the first argument it receives', () => {
    expect(identityFunc()).to.equal(undefined);
    expect(identityFunc(undefined)).to.equal(undefined);
    expect(identityFunc(null)).to.equal(null);

    const obj = {};
    expect(identityFunc(obj)).to.equal(obj);
  });
});
