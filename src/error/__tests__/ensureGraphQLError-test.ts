import { describe, it } from 'node:test';

import { expect } from 'chai';

import { ensureGraphQLError } from '../ensureGraphQLError.ts';
import { GraphQLError } from '../GraphQLError.ts';

describe('ensureGraphQLError', () => {
  it('passes GraphQLError through', () => {
    const error = new GraphQLError('boom');
    expect(ensureGraphQLError(error)).to.equal(error);
  });

  it('wraps Error values as GraphQLError', () => {
    const originalError = new Error('boom');
    const error = ensureGraphQLError(originalError);

    expect(error).to.be.instanceOf(GraphQLError);
    expect(error.message).to.equal('boom');
    expect(error.originalError).to.equal(originalError);
  });

  it('wraps non-error thrown values', () => {
    const error = ensureGraphQLError('boom');

    expect(error).to.be.instanceOf(GraphQLError);
    expect(error.message).to.equal('Unexpected error value: "boom"');
    expect(error.originalError).to.include({
      name: 'NonErrorThrown',
      thrownValue: 'boom',
    });
  });
});
