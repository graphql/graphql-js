import { expect } from 'chai';
import { describe, it } from 'mocha';

import { GraphQLAggregateError } from '../GraphQLAggregateError';

describe('GraphQLAggregateError', () => {
  it('is a class and is a subclass of Error', () => {
    const errors = [new Error('Error1'), new Error('Error2')];
    expect(new GraphQLAggregateError(errors)).to.be.instanceof(Error);
    expect(new GraphQLAggregateError(errors)).to.be.instanceof(
      GraphQLAggregateError,
    );
  });

  it('has a name, errors, and a message (if provided)', () => {
    const errors = [new Error('Error1'), new Error('Error2')];
    const e = new GraphQLAggregateError(errors, 'msg');

    expect(e).to.include({
      name: 'GraphQLAggregateError',
      errors,
      message: 'msg',
    });
  });
});
