import { expect } from 'chai';
import { describe, it } from 'mocha';

import { AbortedGraphQLExecutionError } from '../AbortedGraphQLExecutionError.js';

describe('AbortedGraphQLExecutionError', () => {
  it('uses the original Error reason message and cause', () => {
    const reason = new Error('Original reason');
    const result = { data: { ok: true } };

    const error = new AbortedGraphQLExecutionError(reason, result);

    expect(error).to.be.instanceof(Error);
    expect(error).to.be.instanceof(AbortedGraphQLExecutionError);
    expect(error).to.include({
      name: 'AbortedGraphQLExecutionError',
      message: 'Original reason',
      cause: reason,
      abortedResult: result,
    });
    expect(Object.prototype.toString.call(error)).to.equal(
      '[object AbortedGraphQLExecutionError]',
    );
  });

  it('uses the message property from non-Error reasons', () => {
    const reason = { message: 'Object reason' };
    const result = Promise.resolve({ data: null });

    const error = new AbortedGraphQLExecutionError(reason, result);

    expect(error).to.include({
      message: 'Object reason',
      cause: reason,
      abortedResult: result,
    });
  });

  it('stringifies reasons without a message', () => {
    const error = new AbortedGraphQLExecutionError('String reason', {
      data: null,
    });

    expect(error).to.include({
      message: 'String reason',
      cause: 'String reason',
    });
  });

  it('stringifies null reasons', () => {
    const error = new AbortedGraphQLExecutionError(null, { data: null });

    expect(error).to.include({
      message: 'null',
      cause: null,
    });
  });
});
