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

import { GraphQLError } from '../GraphQLError';
import { locatedError } from '../locatedError';

describe('locatedError', () => {
  it('passes GraphQLError through', () => {
    const e = new GraphQLError('msg', null, null, null, [
      'path',
      3,
      'to',
      'field',
    ]);

    expect(locatedError(e, [], [])).to.deep.equal(e);
  });

  it('passes GraphQLError-ish through', () => {
    const e: any = new Error('I have a different prototype chain');
    e.locations = [];
    e.path = [];
    e.nodes = [];
    e.source = null;
    e.positions = [];
    e.name = 'GraphQLError';

    expect(locatedError(e, [], [])).to.deep.equal(e);
  });

  it('does not pass through elasticsearch-like errors', () => {
    const e: any = new Error('I am from elasticsearch');
    e.path = '/something/feed/_search';

    expect(locatedError(e, [], [])).to.not.deep.equal(e);
  });
});
