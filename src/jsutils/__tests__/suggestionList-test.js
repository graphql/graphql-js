/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import suggestionList from '../suggestionList';

describe('suggestionList', () => {

  it('Returns results when input is empty', () => {
    expect(suggestionList('', [ 'a' ])).to.deep.equal([ 'a' ]);
  });

  it('Returns empty array when there are no options', () => {
    expect(suggestionList('input', [])).to.deep.equal([]);
  });

  it('Returns options sorted based on similarity', () => {
    expect(suggestionList('abc', [ 'a', 'ab', 'abc' ]))
      .to.deep.equal([ 'abc', 'ab' ]);
  });
});
