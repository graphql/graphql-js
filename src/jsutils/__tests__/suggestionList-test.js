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
import suggestionList from '../suggestionList';

describe('suggestionList', () => {
  it('Returns results when input is empty', () => {
    expect(suggestionList('', ['a'])).to.deep.equal(['a']);
  });

  it('Returns empty array when there are no options', () => {
    expect(suggestionList('input', [])).to.deep.equal([]);
  });

  it('Returns options sorted based on similarity', () => {
    expect(suggestionList('abc', ['a', 'ab', 'abc'])).to.deep.equal([
      'abc',
      'ab',
    ]);
  });
});
