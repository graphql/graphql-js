import { describe, it } from 'node:test';

import { assert, expect } from 'chai';

import { isAsyncIterable } from '../../jsutils/isAsyncIterable.ts';

import { expectEqualPromisesOrValuesOrAsyncIterables } from '../expectEqualPromisesOrValuesOrAsyncIterables.ts';
import { expectPromise } from '../expectPromise.ts';

async function* source<T>(
  values: ReadonlyArray<T>,
): AsyncGenerator<T, void, void> {
  await Promise.resolve();
  for (const value of values) {
    yield value;
  }
}

async function collectAsyncIterable<T>(
  iterable: AsyncIterable<T>,
): Promise<ReadonlyArray<T>> {
  const values = [];
  for await (const value of iterable) {
    values.push(value);
  }
  return values;
}

describe('expectEqualPromisesOrValuesOrAsyncIterables', () => {
  it('returns matching values', () => {
    const testValue = { test: 'test' };

    expect(
      expectEqualPromisesOrValuesOrAsyncIterables([
        () => testValue,
        () => ({ test: 'test' }),
        () => ({ test: 'test' }),
      ]),
    ).to.equal(testValue);
  });

  it('throws when values do not match', () => {
    expect(() =>
      expectEqualPromisesOrValuesOrAsyncIterables([
        () => ({}),
        () => ({}),
        () => ({ test: 'test' }),
      ]),
    ).to.throw("expected { test: 'test' } to deeply equal {}");
  });

  it('resolves matching promises', async () => {
    const testValue = { test: 'test' };

    await expectPromise(
      expectEqualPromisesOrValuesOrAsyncIterables([
        () => Promise.resolve(testValue),
        () => Promise.resolve({ test: 'test' }),
      ]),
    ).toResolve();
  });

  it('rejects when promises do not match', async () => {
    await expectPromise(
      expectEqualPromisesOrValuesOrAsyncIterables([
        () => Promise.resolve({}),
        () => Promise.resolve({ test: 'test' }),
      ]),
    ).toRejectWith("expected { test: 'test' } to deeply equal {}");
  });

  it('rejects when promises reject with matching errors', async () => {
    await expectPromise(
      expectEqualPromisesOrValuesOrAsyncIterables([
        () => Promise.reject(new Error('test error')),
        () => Promise.reject(new Error('test error')),
      ]),
    ).toRejectWith('test error');
  });

  it('yields matching async iterable values', async () => {
    const result = expectEqualPromisesOrValuesOrAsyncIterables<number>([
      () => source([1, 2]),
      () => source([1, 2]),
    ]);
    assert(isAsyncIterable(result));

    expect(await collectAsyncIterable(result)).to.deep.equal([1, 2]);
  });

  it('resolves matching async iterable values', async () => {
    const result = await expectEqualPromisesOrValuesOrAsyncIterables<number>([
      () => Promise.resolve(source([1, 2])),
      () => Promise.resolve(source([1, 2])),
    ]);
    assert(isAsyncIterable(result));

    expect(await collectAsyncIterable(result)).to.deep.equal([1, 2]);
  });

  it('rejects when async iterable values do not match', async () => {
    const result = expectEqualPromisesOrValuesOrAsyncIterables<number>([
      () => source([1]),
      () => source([2]),
    ]);
    assert(isAsyncIterable(result));

    const error = await expectPromise(collectAsyncIterable(result)).toReject();

    expect(error).to.be.an.instanceOf(Error);
    expect(error).to.have.property('message').that.contains('deeply equal');
  });

  it('throws when given a mixture of promises and values', () => {
    expect(() =>
      expectEqualPromisesOrValuesOrAsyncIterables([
        () => ({ test: 'test' }),
        () => Promise.resolve({ test: 'test' }),
      ]),
    ).to.throw('Received an invalid mixture of promises and values.');
  });

  it('rejects when promises resolve to a mixture of values and async iterables', async () => {
    await expectPromise(
      expectEqualPromisesOrValuesOrAsyncIterables<number>([
        () => Promise.resolve(1),
        () => Promise.resolve(source([1])),
      ]),
    ).toRejectWith(
      'Received an invalid mixture of async iterables and values.',
    );
  });
});
