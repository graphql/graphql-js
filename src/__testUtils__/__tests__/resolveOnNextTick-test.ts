import { expect } from 'chai';
import { describe, it } from 'mocha';

import { resolveOnNextTick } from '../resolveOnNextTick.js';

describe('resolveOnNextTick', () => {
  it('resolves promise on the next tick', async () => {
    const output = [];

    async function outputOnNextTick(message: string) {
      await resolveOnNextTick();
      output.push(message);
    }

    const promise1 = outputOnNextTick('second');
    const promise2 = outputOnNextTick('third');
    output.push('first');

    await Promise.all([promise1, promise2]);
    expect(output).to.deep.equal(['first', 'second', 'third']);
  });
});
