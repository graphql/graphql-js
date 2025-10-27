import { expect } from 'chai';
import { describe, it } from 'mocha';

import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

import { promiseWithResolvers } from '../../jsutils/promiseWithResolvers.js';

import { Queue } from '../Queue.js';

describe('Queue', () => {
  it('should yield sync pushed items in order', async () => {
    const queue = new Queue<number>((push) => {
      push(1);
      push(2);
      push(3);
    });

    const sub = queue.subscribe((batch) => Array.from(batch));
    expect(await sub.next()).to.deep.equal({ done: false, value: [1, 2, 3] });
  });

  it('should yield async pushed items in order', async () => {
    const queue = new Queue<number>(async (push) => {
      await resolveOnNextTick();
      push(1);
      push(2);
      push(3);
    });

    const sub = queue.subscribe((batch) => Array.from(batch));
    expect(await sub.next()).to.deep.equal({ done: false, value: [1, 2, 3] });
  });

  it('should yield multiple batches', async () => {
    const queue = new Queue<number>(async (push) => {
      await resolveOnNextTick();
      push(1);
      push(2);
      push(3);
      await resolveOnNextTick();
      push(4);
      push(5);
      push(6);
    });

    const sub = queue.subscribe((batch) => Array.from(batch));
    expect(await sub.next()).to.deep.equal({ done: false, value: [1, 2, 3] });
    expect(await sub.next()).to.deep.equal({ done: false, value: [4, 5, 6] });
  });

  it('should allow the executor to indicate completion', async () => {
    const queue = new Queue<number>(async (_push, stop) => {
      await resolveOnNextTick();
      stop();
    });

    const sub = queue.subscribe((batch) => batch);
    expect(await sub.next()).to.deep.equal({ done: true, value: undefined });
  });

  it('should allow a consumer to abort a pending call to nextBatch', async () => {
    const queue = new Queue<number>(async () => {
      const { promise } = promiseWithResolvers();
      // wait forever
      await promise;
    });

    const sub = queue.subscribe((batch) => batch);
    const nextPromise = sub.next();
    queue.stop();
    expect(await nextPromise).to.deep.equal({ done: true, value: undefined });
  });

  it('should allow saving the push function', async () => {
    let push!: (item: number) => void;
    const queue = new Queue<number>((_push) => {
      push = _push;
    });

    const sub = queue.subscribe((batch) => Array.from(batch));

    await resolveOnNextTick();
    push(1);
    push(2);
    push(3);

    expect(await sub.next()).to.deep.equal({ done: false, value: [1, 2, 3] });
  });

  it('should stop on sync error in the executor', async () => {
    const queue = new Queue<number>(() => {
      throw new Error('Oops');
    });

    const sub = queue.subscribe((batch) => Array.from(batch));
    expect(await sub.next()).to.deep.equal({ done: true, value: undefined });
  });

  it('should stop on async errors in the executor', async () => {
    const queue = new Queue<number>(async () => {
      await resolveOnNextTick();
      throw new Error('Oops');
    });

    const sub = queue.subscribe((batch) => Array.from(batch));
    expect(await sub.next()).to.deep.equal({ done: true, value: undefined });
  });

  it('should skip payloads when mapped to undefined, skipping first async payload', async () => {
    const queue = new Queue<number>(async (push) => {
      await resolveOnNextTick();
      push(1);
      await resolveOnNextTick();
      push(2);
      await resolveOnNextTick();
      push(3);
      await resolveOnNextTick();
      push(4);
      await resolveOnNextTick();
      push(5);
      await resolveOnNextTick();
      push(6);
    });

    const sub = queue.subscribe((batch) => {
      const arr = Array.from(batch);
      if (arr[0] % 2 === 0) {
        return arr;
      }
    });
    expect(await sub.next()).to.deep.equal({ done: false, value: [2] });
    // [3, 4, 5] are batched as we await 2:
    // - one tick for the [AsyncGeneratorResumeNext] job
    // - one tick for the await within the withCleanUp next()
    expect(await sub.next()).to.deep.equal({ done: false, value: [6] });
  });

  it('should condense pushes during map into the same batch', async () => {
    let push!: (item: number) => void;
    const queue = new Queue<number>((_push) => {
      push = _push;
    });

    await resolveOnNextTick();
    push(1);
    push(2);

    const itemsToAdd = [3, 4];
    const items: Array<number> = [];
    const sub = queue.subscribe((batch) => {
      for (const item of batch) {
        const itemToAdd = itemsToAdd.shift();
        if (itemToAdd !== undefined) {
          push(itemToAdd);
        }
        items.push(item);
      }
      return items;
    });
    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [1, 2, 3, 4],
    });
  });
});
