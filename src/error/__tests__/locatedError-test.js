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
    const e = new Error();
    // $FlowExpectedError[prop-missing]
    e.locations = [];
    // $FlowExpectedError[prop-missing]
    e.path = [];
    // $FlowExpectedError[prop-missing]
    e.nodes = [];
    // $FlowExpectedError[prop-missing]
    e.source = null;
    // $FlowExpectedError[prop-missing]
    e.positions = [];
    e.name = 'GraphQLError';

    expect(locatedError(e, [], [])).to.deep.equal(e);
  });

  it('does not pass through elasticsearch-like errors', () => {
    const e = new Error('I am from elasticsearch');
    // $FlowExpectedError[prop-missing]
    e.path = '/something/feed/_search';

    expect(locatedError(e, [], [])).to.not.deep.equal(e);
  });
});
