import { expect } from 'chai';
import { describe, it } from 'mocha';

import { GraphQLError } from '../GraphQLError';
import { locatedError } from '../locatedError';

describe('locatedError', () => {
  it('passes GraphQLError through', () => {
    const e = new GraphQLError('msg', { path: ['path', 3, 'to', 'field'] });

    expect(locatedError(e, [], [])).to.deep.equal(e);
  });

  it('wraps non-errors', () => {
    const testObject = Object.freeze({});
    const error = locatedError(testObject, [], []);

    expect(error).to.be.instanceOf(GraphQLError);
    expect(error.originalError).to.include({
      name: 'NonErrorThrown',
      thrownValue: testObject,
    });
  });

  it('passes GraphQLError-ish through', () => {
    const e = new Error();
    // @ts-expect-error
    e.locations = [];
    // @ts-expect-error
    e.path = [];
    // @ts-expect-error
    e.nodes = [];
    // @ts-expect-error
    e.source = null;
    // @ts-expect-error
    e.positions = [];
    e.name = 'GraphQLError';

    expect(locatedError(e, [], [])).to.deep.equal(e);
  });

  it('does not pass through elasticsearch-like errors', () => {
    const e = new Error('I am from elasticsearch');
    // @ts-expect-error
    e.path = '/something/feed/_search';

    expect(locatedError(e, [], [])).to.not.deep.equal(e);
  });
});
