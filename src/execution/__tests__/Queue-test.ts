import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { promiseWithResolvers } from '../../jsutils/promiseWithResolvers.js';

import { Queue } from '../Queue.js';

describe('Queue', () => {
  it('should yield sync pushed items in order', () => {
    const queue = new Queue<number>((push) => {
      push(1);
      push(2);
      push(3);
    });

    const batch1 = queue.currentBatch();
    assert(batch1 !== undefined);
    expect(Array.from(batch1)).to.deep.equal([1, 2, 3]);
  });

  it('should yield async pushed items in order', async () => {
    const queue = new Queue<number>(async (push) => {
      await Promise.resolve();
      push(1);
      push(2);
      push(3);
    });

    const batch1 = queue.currentBatch();
    expect(batch1).to.deep.equal(undefined);
    const batch2 = await queue.nextBatch();
    assert(batch2 !== undefined);
    expect(Array.from(batch2)).to.deep.equal([1, 2, 3]);
  });

  it('should yield multiple batches', async () => {
    const queue = new Queue<number>(async (push) => {
      await Promise.resolve();
      push(1);
      push(2);
      push(3);
      await Promise.resolve();
      push(4);
      push(5);
      push(6);
    });

    const batch1 = queue.currentBatch();
    expect(batch1).to.equal(undefined);
    const batch2 = await queue.nextBatch();
    assert(batch2 !== undefined);
    expect(Array.from(batch2)).to.deep.equal([1, 2, 3]);
    const batch3 = await queue.nextBatch();
    assert(batch3 !== undefined);
    expect(Array.from(batch3)).to.deep.equal([4, 5, 6]);
  });

  it('should allow the executor to indicate completion', async () => {
    const queue = new Queue<number>(async (_push, stop) => {
      await Promise.resolve();
      stop();
    });

    const batch1 = queue.currentBatch();
    expect(batch1).to.equal(undefined);
    const batch2 = await queue.nextBatch();
    expect(batch2).to.equal(undefined);
  });

  it('should allow a consumer to abort a pending call to nextBatch', async () => {
    const queue = new Queue<number>(async () => {
      const { promise } = promiseWithResolvers();
      // wait forever
      await promise;
    });

    const batch1 = queue.currentBatch();
    expect(batch1).to.equal(undefined);
    const batch2Promise = queue.nextBatch();
    queue.stop();
    expect(await batch2Promise).to.equal(undefined);
  });

  it('should allow saving the push function', async () => {
    let push!: (item: number) => void;
    const queue = new Queue<number>((_push) => {
      push = _push;
    });

    const batch1 = queue.currentBatch();
    expect(batch1).to.equal(undefined);

    const batch2Promise = queue.nextBatch();

    await Promise.resolve();
    push(1);
    push(2);
    push(3);

    const batch2 = await batch2Promise;
    assert(batch2 !== undefined);
    expect(Array.from(batch2)).to.deep.equal([1, 2, 3]);
  });

  it('should ignore sync errors in the executor', async () => {
    const queue = new Queue<number>(() => {
      throw new Error('Oops');
    });
    const batch1 = queue.currentBatch();
    expect(batch1).to.equal(undefined);
    const batch2Promise = queue.nextBatch();
    queue.stop();
    expect(await batch2Promise).to.equal(undefined);
  });

  it('should ignore async errors in the executor', async () => {
    const queue = new Queue<number>(async () => {
      await Promise.resolve();
      throw new Error('Oops');
    });
    const batch1 = queue.currentBatch();
    expect(batch1).to.equal(undefined);
    const batch2Promise = queue.nextBatch();
    queue.stop();
    expect(await batch2Promise).to.equal(undefined);
  });
});
