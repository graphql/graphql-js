import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectPromise } from '../expectPromise.ts';
import { withAsyncUsing } from '../withAsyncUsing.ts';

describe('withAsyncUsing', () => {
  it('disposes resource at end of scope', async () => {
    const events: Array<string> = [];
    const resource = {
      async [Symbol.asyncDispose]() {
        await Promise.resolve();
        events.push('dispose');
      },
    };

    await withAsyncUsing(resource, async () => {
      await Promise.resolve();
      events.push('use');
    });

    expect(events).to.deep.equal(['use', 'dispose']);
  });

  it('disposes resource when callback throws', async () => {
    const events: Array<string> = [];
    const resource = {
      async [Symbol.asyncDispose]() {
        await Promise.resolve();
        events.push('dispose');
      },
    };

    await expectPromise(
      withAsyncUsing(resource, async () => {
        await Promise.resolve();
        events.push('use');
        throw new Error('boom');
      }),
    ).toRejectWith('boom');

    expect(events).to.deep.equal(['use', 'dispose']);
  });
});
