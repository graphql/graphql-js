import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../../__testUtils__/expectPromise.js';

import { flattenAsyncIterable } from '../flattenAsyncIterable.js';

describe('flattenAsyncIterable', () => {
  it('flatten nested async generators', async () => {
    async function* source() {
      yield await Promise.resolve({
        value: 1,
        nestedIterable: (async function* nested(): AsyncGenerator<
          number,
          void,
          void
        > {
          yield await Promise.resolve(1.1);
          yield await Promise.resolve(1.2);
        })(),
      });
      yield await Promise.resolve({
        value: 2,
        nestedIterable: (async function* nested(): AsyncGenerator<
          number,
          void,
          void
        > {
          yield await Promise.resolve(2.1);
          yield await Promise.resolve(2.2);
        })(),
      });
    }

    const doubles = flattenAsyncIterable(source(), (item) => item);

    const result = [];
    for await (const x of doubles) {
      result.push(x);
    }
    expect(result).to.deep.equal([1, 1.1, 1.2, 2, 2.1, 2.2]);
  });

  it('passes through errors from a nested async generator', async () => {
    async function* source() {
      yield await Promise.resolve({
        value: 1,
        nestedIterable: (async function* nested(): AsyncGenerator<
          number,
          void,
          void
        > {
          yield await Promise.resolve(1.1);
          yield await Promise.resolve(1.2);
        })(),
      });
      throw new Error('ouch');
    }
    /* c8 ignore stop */

    const doubles = flattenAsyncIterable(source(), (item) => item);

    expect(await doubles.next()).to.deep.equal({ value: 1, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 1.1, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 1.2, done: false });

    await expectPromise(doubles.next()).toRejectWith('ouch');
  });

  it('allows returning early from a nested async generator', async () => {
    async function* source() {
      yield await Promise.resolve({
        value: 1,
        nestedIterable: (async function* nested(): AsyncGenerator<
          number,
          void,
          void
        > {
          yield await Promise.resolve(1.1);
          yield await Promise.resolve(1.2);
        })(),
      });
      yield await Promise.resolve({
        value: 2,
        nestedIterable: (async function* nested(): AsyncGenerator<
          number,
          void,
          void
        > {
          yield await Promise.resolve(2.1); /* c8 ignore start */
          // Not reachable, early return
          yield await Promise.resolve(2.2);
        })(),
      });
      // Not reachable, early return
      yield await Promise.resolve({
        value: 3,
        nestedIterable: (async function* nested(): AsyncGenerator<
          number,
          void,
          void
        > {
          yield await Promise.resolve(3.1);
          yield await Promise.resolve(3.2);
        })(),
      });
    }
    /* c8 ignore stop */

    const doubles = flattenAsyncIterable(source(), (item) => item);

    expect(await doubles.next()).to.deep.equal({ value: 1, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 1.1, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 1.2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 2.1, done: false });

    // Early return
    expect(await doubles.return()).to.deep.equal({
      value: undefined,
      done: true,
    });

    // Subsequent next calls
    expect(await doubles.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
    expect(await doubles.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('allows throwing errors into a nested async generator', async () => {
    async function* source() {
      yield await Promise.resolve({
        value: 1,
        nestedIterable: (async function* nested(): AsyncGenerator<
          number,
          void,
          void
        > {
          yield await Promise.resolve(1.1);
          yield await Promise.resolve(1.2);
        })(),
      });
      yield await Promise.resolve({
        value: 2,
        nestedIterable: (async function* nested(): AsyncGenerator<
          number,
          void,
          void
        > {
          yield await Promise.resolve(2.1); /* c8 ignore start */
          // Not reachable, early return
          yield await Promise.resolve(2.2);
        })(),
      });
      // Not reachable, early return
      yield await Promise.resolve({ value: 3 });
    }
    /* c8 ignore stop */

    const doubles = flattenAsyncIterable(source(), (item) => item);

    expect(await doubles.next()).to.deep.equal({ value: 1, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 1.1, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 1.2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 2.1, done: false });

    // Throw error
    await expectPromise(doubles.throw(new Error('ouch'))).toRejectWith('ouch');
  });

  it('completely yields sub-iterables even when next() called in parallel', async () => {
    async function* source() {
      yield await Promise.resolve({
        value: 1,
        nestedIterable: (async function* nested(): AsyncGenerator<
          number,
          void,
          void
        > {
          yield await Promise.resolve(1.1);
          yield await Promise.resolve(1.2);
        })(),
      });
      yield await Promise.resolve({
        value: 2,
        nestedIterable: (async function* nested(): AsyncGenerator<
          number,
          void,
          void
        > {
          yield await Promise.resolve(2.1);
          yield await Promise.resolve(2.2);
        })(),
      });
    }

    const result = flattenAsyncIterable(source(), (item) => item);

    const promise1 = result.next();
    const promise2 = result.next();
    const promise3 = result.next();
    expect(await promise1).to.deep.equal({ value: 1, done: false });
    expect(await promise2).to.deep.equal({ value: 1.1, done: false });
    expect(await promise3).to.deep.equal({ value: 1.2, done: false });
    expect(await result.next()).to.deep.equal({ value: 2, done: false });
    expect(await result.next()).to.deep.equal({ value: 2.1, done: false });
    expect(await result.next()).to.deep.equal({ value: 2.2, done: false });
    expect(await result.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });
});
