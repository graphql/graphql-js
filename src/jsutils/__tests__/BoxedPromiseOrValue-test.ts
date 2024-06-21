import { expect } from 'chai';
import { describe, it } from 'mocha';

import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

import { BoxedPromiseOrValue } from '../BoxedPromiseOrValue.js';

describe('BoxedPromiseOrValue', () => {
  it('can box a value', () => {
    const boxed = new BoxedPromiseOrValue<number>(42);

    expect(boxed.value).to.equal(42);
  });

  it('can box a promise', () => {
    const promise = Promise.resolve(42);
    const boxed = new BoxedPromiseOrValue<number>(promise);

    expect(boxed.value).to.equal(promise);
  });

  it('resets the boxed value when the passed promise resolves', async () => {
    const promise = Promise.resolve(42);
    const boxed = new BoxedPromiseOrValue<number>(promise);

    await resolveOnNextTick();

    expect(boxed.value).to.equal(42);
  });
});
