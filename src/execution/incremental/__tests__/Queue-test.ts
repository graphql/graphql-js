/* eslint-disable @typescript-eslint/no-floating-promises */

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../../../__testUtils__/expectPromise.js';
import { resolveOnNextTick } from '../../../__testUtils__/resolveOnNextTick.js';

import { invariant } from '../../../jsutils/invariant.js';
import { isPromise } from '../../../jsutils/isPromise.js';
import type { PromiseOrValue } from '../../../jsutils/PromiseOrValue.js';
import { promiseWithResolvers } from '../../../jsutils/promiseWithResolvers.js';

import { Queue } from '../Queue.js';

describe('Queue', () => {
  it('should yield sync items pushed synchronously', async () => {
    const sub = new Queue(({ push }) => {
      push(1);
      push(2);
      push(3);
    }).subscribe();

    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [1, 2, 3],
    });
  });

  it('should yield sync items pushed after initial delay', async () => {
    const sub = new Queue(async ({ push }) => {
      await resolveOnNextTick();
      push(1);
      push(2);
      push(3);
    }).subscribe();

    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [1, 2, 3],
    });
  });

  it('should yield sync items pushed prior to and after delay', async () => {
    const sub = new Queue(async ({ push }) => {
      push(1);
      push(2);
      push(3);
      await resolveOnNextTick();
      push(4);
      push(5);
      push(6);
    }).subscribe();

    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [1, 2, 3, 4, 5, 6],
    });
  });

  it('should yield sync items pushed prior to and after macro-task boundary', async () => {
    const sub = new Queue(async ({ push }) => {
      push(1);
      push(2);
      push(3);
      // awaiting macro-task delay
      await new Promise((r) => setTimeout(r));
      push(4);
      push(5);
      push(6);
    }).subscribe();

    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [1, 2, 3],
    });
    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [4, 5, 6],
    });
  });

  it('should yield multiple batches of sync items', async () => {
    const sub = new Queue(async ({ push }) => {
      for (let i = 1; i <= 28; i += 3) {
        // eslint-disable-next-line no-await-in-loop
        await resolveOnNextTick();
        push(i);
        push(i + 1);
        push(i + 2);
      }
    }).subscribe();

    expect(await sub.next()).to.deep.equal({ done: false, value: [1, 2, 3] });
    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    });
    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [13, 14, 15, 16, 17, 18, 19, 20, 21],
    });
    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [22, 23, 24, 25, 26, 27, 28, 29, 30],
    });
  });

  it('should allow the executor to indicate completion', async () => {
    const sub = new Queue(({ push, stop }) => {
      push(1);
      stop();
    }).subscribe();

    expect(await sub.next()).to.deep.equal({ done: false, value: [1] });
    expect(await sub.next()).to.deep.equal({ done: true, value: undefined });
  });

  it('returns stopped state synchronously when completed before push', () => {
    let stop!: (reason?: unknown) => void;
    const queue = new Queue(({ stop: savedStop }) => {
      stop = savedStop;
    });

    expect(queue.isStopped()).to.equal(false);
    stop();
    expect(queue.isStopped()).to.equal(true);
  });

  it('reports stopped after flushing remaining work', async () => {
    const queue = new Queue(({ push, stop }) => {
      push(1);
      stop();
    });
    const sub = queue.subscribe();

    expect(queue.isStopped()).to.equal(false);
    expect(await sub.next()).to.deep.equal({ done: false, value: [1] });
    expect(queue.isStopped()).to.equal(true);
  });

  it('should allow the executor to indicate completion prior to any push calls', async () => {
    const sub = new Queue(({ push, stop }) => {
      stop();
      push(1); // should be ignored
    }).subscribe();

    expect(await sub.next()).to.deep.equal({ done: true, value: undefined });
  });

  it('ignores repeated stop calls', async () => {
    const sub = new Queue(({ stop }) => {
      stop();
      stop();
    }).subscribe();

    expect(await sub.next()).to.deep.equal({ done: true, value: undefined });
  });

  it('abort is a no-op after stopping', async () => {
    const queue = new Queue(({ stop }) => {
      stop();
    });

    const sub = queue.subscribe();

    expect(queue.isStopped()).to.equal(true);
    queue.abort(new Error('ignored'));

    expect(await sub.next()).to.deep.equal({ done: true, value: undefined });
  });

  it('should resolve a pending next call when stopped before any pushes', async () => {
    let stop!: (reason?: unknown) => void;
    const sub = new Queue(({ stop: savedStop }) => {
      stop = savedStop;
    }).subscribe();

    const nextPromise = sub.next();

    stop();

    expect(await nextPromise).to.deep.equal({ done: true, value: undefined });
  });

  it('should allow a consumer to abort a pending call to next', async () => {
    const sub = new Queue(() => {
      // no pushes
    }).subscribe();

    const nextPromise = sub.next();
    await sub.return();
    expect(await nextPromise).to.deep.equal({ done: true, value: undefined });
  });

  it('should allow saving the push function', async () => {
    let push!: (item: number) => PromiseOrValue<void>;
    const sub = new Queue(({ push: savedPush }) => {
      push = savedPush;
    }).subscribe();

    await resolveOnNextTick();
    push(1);
    push(2);
    push(3);

    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [1, 2, 3],
    });
  });

  it('delivers queued items before rejecting on sync executor error', async () => {
    const sub = new Queue(({ push }) => {
      push(1);
      throw new Error('Oops');
    }).subscribe();

    expect(await sub.next()).to.deep.equal({ done: false, value: [1] });
    await expectPromise(sub.next()).toRejectWith('Oops');
  });

  it('delivers queued items before rejecting on async executor error', async () => {
    const sub = new Queue(async ({ push }) => {
      push(1);
      await resolveOnNextTick();
      throw new Error('Oops');
    }).subscribe();

    expect(await sub.next()).to.deep.equal({ done: false, value: [1] });
    await expectPromise(sub.next()).toRejectWith('Oops');
  });

  it('should skip payloads when reduced to undefined, skipping first async payload', async () => {
    const sub = new Queue<number>(async ({ push }) => {
      for (let i = 1; i <= 14; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await resolveOnNextTick();
        push(i);
      }
    }).subscribe((batch) => {
      const arr = Array.from(batch);
      if (arr[0] % 2 === 0) {
        return arr;
      }
    });
    expect(await sub.next()).to.deep.equal({ done: false, value: [2] });
    expect(await sub.next()).to.deep.equal({ done: false, value: [6] });
    expect(await sub.next()).to.deep.equal({ done: false, value: [10] });
  });

  it('accepts async reducer functions', async () => {
    const sub = new Queue<number>(({ push, stop }) => {
      push(1);
      push(2);
      stop();
    }).subscribe(async (batch) => {
      await resolveOnNextTick();
      return Array.from(batch);
    });

    expect(await sub.next()).to.deep.equal({ done: false, value: [1, 2] });
    expect(await sub.next()).to.deep.equal({ done: true, value: undefined });
  });

  it('forEachBatch resolves once the queue is drained', async () => {
    const batches: Array<ReadonlyArray<number>> = [];
    const queue = new Queue<number>(async ({ push, stop }) => {
      push(1);
      await new Promise((resolve) => setTimeout(resolve));
      push(2);
      stop();
    });

    await queue.forEachBatch((batch) => {
      batches.push(Array.from(batch));
    });

    expect(batches).to.deep.equal([[1], [2]]);
  });

  it('allows async reducers to drain the batch later', async () => {
    const queue = new Queue<number>(({ push, stop }) => {
      push(1);
      push(2);
      stop();
    });

    const batches: Array<Generator<number>> = [];
    const finished = queue.forEachBatch((batch) => {
      batches.push(batch);
    });

    await resolveOnNextTick();

    const results = batches.flatMap((batch) => Array.from(batch));

    await finished;

    expect(results).to.deep.equal([1, 2]);
  });

  it('forEachBatch rejects when the reducer throws', async () => {
    const queue = new Queue<number>(({ push }) => {
      push(1);
    });

    await expectPromise(
      queue.forEachBatch(() => {
        throw new Error('Oops');
      }),
    ).toRejectWith('Oops');
  });

  it('should condense pushes reduced into the same batch', async () => {
    let push!: (item: number) => PromiseOrValue<void>;
    const itemsToAdd = [3, 4];
    const items: Array<number> = [];
    const sub = new Queue<number>(({ push: savedPush }) => {
      push = savedPush;
    }).subscribe((batch) => {
      for (const item of batch) {
        const itemToAdd = itemsToAdd.shift();
        if (itemToAdd !== undefined) {
          push(itemToAdd);
        }
        items.push(item);
      }
      return items;
    });

    await resolveOnNextTick();
    push(1);
    push(2);

    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [1, 2, 3, 4],
    });
  });

  it('exposes capacity controllers for fine-grained backpressure', async () => {
    let push!: (item: number) => PromiseOrValue<void>;
    const queue = new Queue<number>(({ push: savedPush }) => {
      push = savedPush;
    }, 1);

    const sub = queue.subscribe();

    expect(queue.getCapacity()).to.equal(1);
    queue.setCapacity(3);

    expect(push(1)).to.equal(undefined);
    expect(push(2)).to.equal(undefined);
    const push3 = push(3);
    let resumed = false;
    invariant(isPromise(push3));
    push3.then(() => {
      resumed = true;
    });

    expect(await sub.next()).to.deep.equal({ done: false, value: [1, 2, 3] });
    await Promise.resolve(push3);
    expect(resumed).to.equal(true);
    await sub.return();
  });

  it('resolves pending pushes when capacity increases', async () => {
    let push!: (item: number) => PromiseOrValue<void>;
    const queue = new Queue<number>(({ push: savedPush }) => {
      push = savedPush;
    }, 1);

    const sub = queue.subscribe();

    const push1 = push(1);
    const push2 = push(2);
    let resolved1 = false;
    let resolved2 = false;
    invariant(isPromise(push1));
    push1.then(() => {
      resolved1 = true;
    });
    invariant(isPromise(push2));
    push2.then(() => {
      resolved2 = true;
    });

    await resolveOnNextTick();
    expect(resolved1).to.equal(false);
    expect(resolved2).to.equal(false);

    expect(queue.getCapacity()).to.equal(1);
    queue.setCapacity(3);

    await resolveOnNextTick();
    expect(resolved1).to.equal(true);
    expect(resolved2).to.equal(true);

    await sub.return();
  });

  it('wakes waiting next calls when batches finish', async () => {
    let resolvePush!: (value: number) => void;
    const sub = new Queue(({ push }) => {
      push(1);
      push(
        new Promise<number>((resolve) => {
          resolvePush = resolve;
        }),
      );
    }).subscribe();

    expect(await sub.next()).to.deep.equal({ done: false, value: [1] });

    const nextPromise = sub.next();
    resolvePush(2);

    expect(await nextPromise).to.deep.equal({ done: false, value: [2] });

    const thirdPromise = sub.next();
    await sub.return();

    expect(await thirdPromise).to.deep.equal({ done: true, value: undefined });
  });

  it('should yield promised items in order once resolved', async () => {
    const sub = new Queue(({ push }) => {
      push(Promise.resolve(1));
      push(Promise.resolve(2));
      push(Promise.resolve(3));
      push(Promise.resolve(4));
      push(Promise.resolve(5));
      push(Promise.resolve(6));
    }).subscribe();

    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [1, 2, 3, 4, 5, 6],
    });
  });

  it('should yield promised items in order even if stopped', async () => {
    const sub = new Queue(({ push, stop }) => {
      push(Promise.resolve(1));
      stop();
    }).subscribe();

    expect(await sub.next()).to.deep.equal({
      done: false,
      value: [1],
    });
    expect(await sub.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

  it('should pause batches behind pending promises', async () => {
    let resolve2!: (value: number) => void;
    const sub = new Queue(({ push }) => {
      push(1);
      const { promise, resolve } = promiseWithResolvers<number>();
      resolve2 = () => resolve(2);
      push(promise);
      push(3);
    }).subscribe();

    expect(await sub.next()).to.deep.equal({ done: false, value: [1] });

    resolve2(2);

    expect(await sub.next()).to.deep.equal({ done: false, value: [2, 3] });
  });

  it('should pause batches behind pending promises', async () => {
    let resolve2!: (value: number) => void;
    let resolve5!: (value: number) => void;
    const sub = new Queue(({ push }) => {
      push(1);
      const { promise: promise2, resolve: _resolve2 } =
        promiseWithResolvers<number>();
      resolve2 = _resolve2;
      push(promise2);
      push(3);
      push(4);
      const { promise: promise5, resolve: _resolve5 } =
        promiseWithResolvers<number>();
      resolve5 = _resolve5;
      push(promise5);
      push(6);
      push(7);
    }).subscribe();

    expect(await sub.next()).to.deep.equal({ done: false, value: [1] });

    resolve2(2);

    expect(await sub.next()).to.deep.equal({ done: false, value: [2, 3, 4] });

    resolve5(5);

    expect(await sub.next()).to.deep.equal({ done: false, value: [5, 6, 7] });
  });

  it('should abort on errored promise with a pending next', async () => {
    let reject!: (reason: unknown) => void;
    const sub = new Queue(({ push }) => {
      push(1);
      const { promise, reject: _reject } = promiseWithResolvers<number>();
      reject = _reject;
      push(promise);
      push(3);
    }).subscribe();

    expect(await sub.next()).to.deep.equal({ done: false, value: [1] });

    const nextPromise = sub.next();

    reject(new Error('Oops'));

    await expectPromise(nextPromise).toRejectWith('Oops');
  });

  it('should abort on errored promise without pending next', async () => {
    let reject!: (reason: unknown) => void;
    const sub = new Queue(({ push }) => {
      push(1);
      const { promise, reject: _reject } = promiseWithResolvers<number>();
      reject = _reject;
      push(promise);
      push(3);
    }).subscribe();

    expect(await sub.next()).to.deep.equal({ done: false, value: [1] });

    reject(new Error('Oops'));

    await resolveOnNextTick();
    await resolveOnNextTick();

    await expectPromise(sub.next()).toRejectWith('Oops');
  });

  it('should abort on errored promise after resuming from normal promise', async () => {
    const sub = new Queue(({ push }) => {
      push(Promise.resolve(1));
      push(Promise.reject(new Error('Oops')));
      push(3);
    }).subscribe();

    expect(await sub.next()).to.deep.equal({ done: false, value: [1] });

    await expectPromise(sub.next()).toRejectWith('Oops');
  });

  it('should resolve push promise when an item is consumed', async () => {
    let pushed = false;
    const sub = new Queue(({ push }) => {
      const push1 = push(1);
      invariant(isPromise(push1));
      push1.then(() => {
        pushed = true;
      });
    }).subscribe();

    expect(pushed).to.equal(false);

    expect(await sub.next()).to.deep.equal({ done: false, value: [1] });
    expect(pushed).to.equal(true);
  });

  it('should resolve push promise when stopped before consumption', async () => {
    let pushed1 = false;
    let pushed2 = false;
    const sub = new Queue(({ push }) => {
      const push1 = push(1);
      invariant(isPromise(push1));
      push1.then(() => {
        pushed1 = true;
      });
      const push2 = push(
        new Promise<number>(() => {
          // never resolve
        }),
      );
      invariant(isPromise(push2));
      push2.then(() => {
        pushed2 = true;
      });
    }).subscribe();

    expect(pushed1).to.equal(false);
    expect(pushed2).to.equal(false);

    await sub.return();

    await resolveOnNextTick();

    expect(pushed1).to.equal(true);
    expect(pushed2).to.equal(true);
  });

  it('should resolve started promise when iteration begins', async () => {
    let startedPromise!: Promise<void>;
    let started = false;
    const sub = new Queue(({ started: _startedPromise }) => {
      startedPromise = _startedPromise;

      startedPromise.then(() => {
        started = true;
      });
    }).subscribe();

    expect(started).to.equal(false);

    sub.next();

    await resolveOnNextTick();

    expect(started).to.equal(true);
  });

  it('should resolve stopped promise when iteration ends', async () => {
    let stoppedPromise!: Promise<unknown>;
    let stopped = false;
    new Queue(({ stop, stopped: _stoppedPromise }) => {
      stoppedPromise = _stoppedPromise;

      stoppedPromise.then(() => {
        stopped = true;
      });
      stop();
    }).subscribe();

    expect(stopped).to.equal(false);

    await resolveOnNextTick();

    expect(stopped).to.equal(true);
  });

  it('stops in an error state when calling stopped with a reason, i.e. the last call to next to reject with that reason', async () => {
    let stoppedPromise!: Promise<unknown>;
    let stopped = false;
    const sub = new Queue(({ push, stop, stopped: _stoppedPromise }) => {
      stoppedPromise = _stoppedPromise;

      stoppedPromise.then(() => {
        stopped = true;
      });
      push(1);
      stop(new Error('Oops'));
    }).subscribe();

    expect(stopped).to.equal(false);

    expect(await sub.next()).to.deep.equal({ done: false, value: [1] });
    await expectPromise(sub.next()).toRejectWith('Oops');

    expect(stopped).to.equal(true);
  });

  it('cancels existing requests when calling cancel', async () => {
    const queue = new Queue(({ push }) => {
      push(
        new Promise(() => {
          // never resolves
        }),
      );
    });
    const sub = queue.subscribe();

    const nextPromise = sub.next();
    queue.cancel();

    expect(await nextPromise).to.deep.equal({ done: true, value: undefined });
  });

  it('aborts existing requests when calling abort', async () => {
    const queue = new Queue(({ push }) => {
      push(
        new Promise(() => {
          // never resolves
        }),
      );
    });
    const sub = queue.subscribe();

    const nextPromise = sub.next();
    queue.abort(new Error('Abort!'));

    await expectPromise(nextPromise).toRejectWith('Abort!');
  });
});
