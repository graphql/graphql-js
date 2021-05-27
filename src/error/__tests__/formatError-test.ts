import { expect } from 'chai';
import { describe, it } from 'mocha';

import { formatError } from '../formatError';
import { GraphQLError } from '../GraphQLError';

describe('formatError: default error formatter', () => {
  it('uses default message', () => {
    // @ts-expect-error
    const e = new GraphQLError();

    expect(formatError(e)).to.deep.equal({
      message: 'An unknown error occurred.',
      path: undefined,
      locations: undefined,
    });
  });

  it('includes path', () => {
    const e = new GraphQLError('msg', null, null, null, [
      'path',
      3,
      'to',
      'field',
    ]);

    expect(formatError(e)).to.deep.equal({
      message: 'msg',
      locations: undefined,
      path: ['path', 3, 'to', 'field'],
    });
  });

  it('includes extension fields', () => {
    const e = new GraphQLError('msg', null, null, null, null, null, {
      foo: 'bar',
    });

    expect(formatError(e)).to.deep.equal({
      message: 'msg',
      locations: undefined,
      path: undefined,
      extensions: { foo: 'bar' },
    });
  });

  it('rejects null and undefined errors', () => {
    // @ts-expect-error (formatError expects a value)
    expect(() => formatError(undefined)).to.throw(
      'Received null or undefined error.',
    );

    // @ts-expect-error (formatError expects a value)
    expect(() => formatError(null)).to.throw(
      'Received null or undefined error.',
    );
  });
});
