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
    const e = new Error('I have a different prototype chain');
    (e: any).locations = [];
    (e: any).path = [];
    (e: any).nodes = [];
    (e: any).source = null;
    (e: any).positions = [];
    (e: any).name = 'GraphQLError';

    expect(locatedError(e, [], [])).to.deep.equal(e);
  });

  it('does not pass through elasticsearch-like errors', () => {
    const e = new Error('I am from elasticsearch');
    (e: any).path = '/something/feed/_search';

    expect(locatedError(e, [], [])).to.not.deep.equal(e);
  });
});
