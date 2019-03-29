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

import asyncIteratorReject from '../asyncIteratorReject';

describe('asyncIteratorReject', () => {
  it('creates a failing async iterator', async () => {
    const error = new Error('Oh no, Mr. Bill!');
    const iter = asyncIteratorReject(error);

    let caughtError;
    try {
      await iter.next();
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).to.equal(error);

    expect(await iter.next()).to.deep.equal({ done: true, value: undefined });
  });

  it('can be closed before failing', async () => {
    const error = new Error('Oh no, Mr. Bill!');
    const iter = asyncIteratorReject(error);

    // Close iterator
    // $FlowFixMe
    expect(await iter.return()).to.deep.equal({ done: true, value: undefined });

    expect(await iter.next()).to.deep.equal({ done: true, value: undefined });
  });
});
