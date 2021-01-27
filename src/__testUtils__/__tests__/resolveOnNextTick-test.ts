import { expect } from 'chai';
import { describe, it } from 'mocha';

import { resolveOnNextTick } from '../resolveOnNextTick';

describe('resolveOnNextTick', () => {
  it('resolves promise on the next tick', async () => {
    const output = [];

    const promise1 = resolveOnNextTick().then(() => {
      output.push('second');
    });
    const promise2 = resolveOnNextTick().then(() => {
      output.push('third');
    });
    output.push('first');

    await Promise.all([promise1, promise2]);
    expect(output).to.deep.equal(['first', 'second', 'third']);
  });
});
