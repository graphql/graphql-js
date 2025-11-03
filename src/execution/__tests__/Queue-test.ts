import { expect } from 'chai';
import { describe, it } from 'mocha';

import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

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

  it('should yield sync and async pushed items in order', async () => {
    const queue = new Queue<number>(async (push) => {
      push(1);
      push(2);
      push(3);
      await resolveOnNextTick();
      push(4);
      push(5);
      push(6);
    });

    const sub = queue.subscribe((batch) => Array.from(batch));
    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [1, 2, 3, 4, 5, 6],
    });
  });

  it('should yield sync and async pushed items in order, separated by macro-task boundary', async () => {
    const queue = new Queue<number>(async (push) => {
      push(1);
      push(2);
      push(3);
      // awaiting macro-task delay
      await new Promise((r) => setTimeout(r));
      push(4);
      push(5);
      push(6);
    });

    const sub = queue.subscribe((batch) => Array.from(batch));
    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [1, 2, 3],
    });
    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [4, 5, 6],
    });
  });

  it('should yield multiple async batches', async () => {
    const queue = new Queue<number>(async (push) => {
      for (let i = 1; i <= 28; i += 3) {
        // eslint-disable-next-line no-await-in-loop
        await resolveOnNextTick();
        push(i);
        push(i + 1);
        push(i + 2);
      }
    });

    const sub = queue.subscribe((batch) => Array.from(batch)[0]);
    expect(await sub.next()).to.deep.equal({ done: false, value: 1 });
    expect(await sub.next()).to.deep.equal({ done: false, value: 4 });
    expect(await sub.next()).to.deep.equal({ done: false, value: 16 });
    expect(await sub.next()).to.deep.equal({ done: false, value: 28 });
  });

  it('should allow the executor to indicate completion', async () => {
    const queue = new Queue<number>((push, stop) => {
      push(1);
      stop();
    });

    const sub = queue.subscribe((batch) => Array.from(batch));
    expect(await sub.next()).to.deep.equal({ done: false, value: [1] });
    expect(await sub.next()).to.deep.equal({ done: true, value: undefined });
  });

  it('should allow the executor to indicate completion prior to any push calls', async () => {
    const queue = new Queue<number>((push, stop) => {
      stop();
      push(1); // should be ignored
    });

    const sub = queue.subscribe((batch) => batch);
    expect(await sub.next()).to.deep.equal({ done: true, value: undefined });
  });

  it('should allow a consumer to abort a pending call to next', async () => {
    const queue = new Queue<number>(() => {
      // no pushes
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

  it('should ignore sync error in the executor', async () => {
    let push!: (item: number) => void;
    const queue = new Queue<number>((_push) => {
      push = _push;
      throw new Error('Oops');
    });

    push(1);

    const sub = queue.subscribe((batch) => Array.from(batch));
    expect(await sub.next()).to.deep.equal({ done: false, value: [1] });
  });

  it('should ignore async error in the executor', async () => {
    let push!: (item: number) => void;
    const queue = new Queue<number>(async (_push) => {
      push = _push;
      await resolveOnNextTick();
      throw new Error('Oops');
    });

    await resolveOnNextTick();
    push(1);

    const sub = queue.subscribe((batch) => Array.from(batch));
    expect(await sub.next()).to.deep.equal({ done: false, value: [1] });
  });

  it('should skip payloads when mapped to undefined, skipping first async payload', async () => {
    const queue = new Queue<number>(async (push) => {
      for (let i = 1; i <= 14; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await resolveOnNextTick();
        push(i);
      }
    });

    const sub = queue.subscribe((batch) => {
      const arr = Array.from(batch);
      if (arr[0] % 2 === 0) {
        return arr;
      }
    });
    expect(await sub.next()).to.deep.equal({ done: false, value: [2] });
    expect(await sub.next()).to.deep.equal({ done: false, value: [8] });
    expect(await sub.next()).to.deep.equal({ done: false, value: [14] });
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
