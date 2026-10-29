import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectPromise } from '../../__testUtils__/expectPromise.ts';

import { promiseForObject } from '../promiseForObject.ts';
import type { PromiseOrValue } from '../PromiseOrValue.ts';

function spyingPromiseAll() {
  const calls: Array<ReadonlyArray<unknown>> = [];
  const promiseAll = <T>(
    values: ReadonlyArray<PromiseOrValue<T>>,
  ): Promise<Array<T>> => {
    calls.push(values);
    return Promise.all(values);
  };
  return { calls, promiseAll };
}

describe('promiseForObject', () => {
  it('passes only promises to promiseAll', async () => {
    const { calls, promiseAll } = spyingPromiseAll();
    const object: { [key: string]: PromiseOrValue<number> } = {};
    for (let i = 0; i < 100; ++i) {
      object[`sync${i}`] = i;
    }
    const promise = Promise.resolve(100);
    object.async = promise;

    const result = await promiseForObject(object, promiseAll);

    expect(calls).to.deep.equal([[promise]]);
    expect(Object.keys(result)).to.deep.equal(Object.keys(object));
    expect(result.sync0).to.equal(0);
    expect(result.sync99).to.equal(99);
    expect(result.async).to.equal(100);
  });

  it('preserves key order when promises are interleaved with values', async () => {
    const { calls, promiseAll } = spyingPromiseAll();
    const first = Promise.resolve('first');
    const second = Promise.resolve('second');
    const object = {
      a: 'a',
      b: first,
      c: 'c',
      d: second,
      e: 'e',
    };

    const result = await promiseForObject(object, promiseAll);

    expect(calls).to.deep.equal([[first, second]]);
    expect(Object.keys(result)).to.deep.equal(['a', 'b', 'c', 'd', 'e']);
    expect(result).to.deep.equal({
      a: 'a',
      b: 'first',
      c: 'c',
      d: 'second',
      e: 'e',
    });
  });

  it('passes non-native thenables to promiseAll', async () => {
    const { calls, promiseAll } = spyingPromiseAll();
    const thenable = {
      then(resolve: (value: string) => void) {
        resolve('thenable');
      },
    };

    const result = await promiseForObject<unknown>(
      { a: 'a', b: thenable },
      promiseAll,
    );

    expect(calls).to.deep.equal([[thenable]]);
    expect(result).to.deep.equal({ a: 'a', b: 'thenable' });
  });

  it('returns a null-prototype object', async () => {
    const result = await promiseForObject(
      { a: Promise.resolve(1) },
      Promise.all.bind(Promise),
    );
    expect(Object.getPrototypeOf(result)).to.equal(null);
  });

  it('resolves an object of only synchronous values', async () => {
    const { calls, promiseAll } = spyingPromiseAll();
    const object = { a: 1, b: 2, c: 3 };

    const promise = promiseForObject(object, promiseAll);

    expect(promise).to.be.instanceOf(Promise);
    expect(await promise).to.deep.equal(object);
    expect(calls).to.deep.equal([[]]);
  });

  it('resolves an object of only promises', async () => {
    const { promiseAll } = spyingPromiseAll();
    const result = await promiseForObject(
      { a: Promise.resolve(1), b: Promise.resolve(2) },
      promiseAll,
    );

    expect(Object.keys(result)).to.deep.equal(['a', 'b']);
    expect(result).to.deep.equal({ a: 1, b: 2 });
  });

  it('resolves an empty object', async () => {
    const result = await promiseForObject({}, spyingPromiseAll().promiseAll);

    expect(result).to.deep.equal({});
  });

  it('rejects when a promise rejects', async () => {
    const { promiseAll } = spyingPromiseAll();

    await expectPromise(
      promiseForObject(
        {
          a: 1,
          b: Promise.reject(new Error('Oops')),
          c: Promise.resolve(3),
        },
        promiseAll,
      ),
    ).toRejectWith('Oops');
  });
});
