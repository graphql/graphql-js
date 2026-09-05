import { describe, it } from 'node:test';

import { expect } from 'chai';

import {
  expectMatchingAsyncIterables,
  expectMatchingAsyncIterablesConcurrently,
} from '../expectMatchingAsyncIterables.ts';
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

describe('expectMatchingAsyncIterables', () => {
  it('yields matching async iterable values', async () => {
    const values = await collectAsyncIterable(
      expectMatchingAsyncIterables([
        source([{ value: 1 }, { value: 2 }]),
        source([{ value: 1 }, { value: 2 }]),
      ]),
    );

    expect(values).to.deep.equal([{ value: 1 }, { value: 2 }]);
  });

  it('rejects when async iterable values do not match', async () => {
    const error = await expectPromise(
      collectAsyncIterable(
        expectMatchingAsyncIterables([
          source([{ value: 1 }]),
          source([{ value: 2 }]),
        ]),
      ),
    ).toReject();

    expect(error).to.be.an.instanceOf(Error);
    expect(error).to.have.property('message').that.contains('deeply equal');
  });

  it('rejects when async iterable lengths do not match', async () => {
    const error = await expectPromise(
      collectAsyncIterable(
        expectMatchingAsyncIterables([source([1]), source([1, 2])]),
      ),
    ).toReject();

    expect(error).to.be.an.instanceOf(Error);
    expect(error).to.have.property('message').that.contains('deeply equal');
  });

  it('rejects with matching async iterable errors', async () => {
    async function* throwingSource(): AsyncGenerator<number, void, void> {
      await Promise.resolve();
      yield 1;
      throw new Error('bad iterator');
    }

    const iterator = expectMatchingAsyncIterables([
      throwingSource(),
      throwingSource(),
    ]);

    expect(await iterator.next()).to.deep.equal({ value: 1, done: false });
    await expectPromise(iterator.next()).toRejectWith('bad iterator');
  });

  it('closes source iterators when the comparison is closed', async () => {
    let firstClosed = false;
    let secondClosed = false;
    async function* closeableSource(): AsyncGenerator<number, void, void> {
      try {
        await Promise.resolve();
        yield 1;
        yield 2;
      } finally {
        firstClosed = true;
      }
    }
    const secondSource = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.resolve({ value: 1, done: false });
          },
          return() {
            secondClosed = true;
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    };

    const iterator = expectMatchingAsyncIterables([
      closeableSource(),
      secondSource,
    ]);
    expect(await iterator.next()).to.deep.equal({ value: 1, done: false });
    await iterator.return();

    expect(firstClosed).to.equal(true);
    expect(secondClosed).to.equal(true);
  });

  it('closes comparisons when source iterators do not implement return', async () => {
    const sourceWithoutReturn = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.resolve({ value: 1, done: false });
          },
        };
      },
    };

    const iterator = expectMatchingAsyncIterables([
      sourceWithoutReturn,
      sourceWithoutReturn,
    ]);
    expect(await iterator.next()).to.deep.equal({ value: 1, done: false });

    expect(await iterator.return()).to.deep.equal({
      value: undefined,
      done: true,
    });
    expect(await iterator.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('closes source iterators while a next call is pending', async () => {
    let resolveNext: ((result: IteratorResult<number>) => void) | undefined;
    let firstClosed = false;
    let secondClosed = false;
    const firstSource = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return new Promise<IteratorResult<number>>((resolve) => {
              resolveNext = resolve;
            });
          },
          return() {
            firstClosed = true;
            resolveNext?.({ done: true, value: undefined });
            return Promise.resolve({ done: true, value: undefined });
          },
        };
      },
    };
    const secondSource = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.resolve({ value: 1, done: false });
          },
          return() {
            secondClosed = true;
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    };

    const iterator = expectMatchingAsyncIterables([firstSource, secondSource]);
    const next = iterator.next();
    await iterator.return();

    expect(await next).to.deep.equal({ done: true, value: undefined });
    expect(firstClosed).to.equal(true);
    expect(secondClosed).to.equal(true);
  });

  it('returns done after comparison has completed', async () => {
    const iterator = expectMatchingAsyncIterables([source([1]), source([1])]);

    expect(await iterator.next()).to.deep.equal({ value: 1, done: false });
    expect(await iterator.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
    expect(await iterator.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('closes remaining iterators when comparison throws', async () => {
    let closed = false;
    const throwingSource = {
      [Symbol.asyncIterator]() {
        let count = 0;
        return {
          next() {
            count += 1;
            if (count === 1) {
              return Promise.resolve({ value: 1, done: false });
            }
            return Promise.reject(new Error('bad iterator'));
          },
          return() {
            closed = true;
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    };

    const iterator = expectMatchingAsyncIterables([
      source([1]),
      throwingSource,
    ]);

    expect(await iterator.next()).to.deep.equal({ value: 1, done: false });
    const error = await expectPromise(iterator.next()).toReject();
    expect(error).to.be.an.instanceOf(Error);
    expect(error).to.have.property('message').that.contains('deeply equal');
    expect(closed).to.equal(true);
  });

  it('closes the source iterator when thrown', async () => {
    let closed = false;
    const closeableSource = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.resolve({ value: 1, done: false });
          },
          return() {
            closed = true;
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    };
    const iterator = expectMatchingAsyncIterables([
      closeableSource,
      source([1]),
    ]);

    await expectPromise(iterator.throw(new Error('thrown'))).toRejectWith(
      'thrown',
    );
    expect(closed).to.equal(true);
  });

  it('throws when source iterator does not implement throw', async () => {
    const sourceWithoutThrow = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.resolve({ value: 1, done: false });
          },
        };
      },
    };
    const iterator = expectMatchingAsyncIterables([
      sourceWithoutThrow,
      source([1]),
    ]);

    await expectPromise(iterator.throw(new Error('thrown'))).toRejectWith(
      'thrown',
    );
  });

  it('can be disposed', async () => {
    let closed = false;
    const closeableSource = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.resolve({ value: 1, done: false });
          },
          return() {
            closed = true;
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    };
    const iterator = expectMatchingAsyncIterables([
      closeableSource,
      source([1]),
    ]);

    await iterator[Symbol.asyncDispose]();

    expect(closed).to.equal(true);
  });
});

describe('expectMatchingAsyncIterablesConcurrently', () => {
  it('yields first iterable values and compares collected values', async () => {
    const values = await collectAsyncIterable(
      expectMatchingAsyncIterablesConcurrently([
        source([{ value: 1 }, { value: 2 }]),
        source([{ value: 1 }, { value: 2 }]),
      ]),
    );

    expect(values).to.deep.equal([{ value: 1 }, { value: 2 }]);
  });

  it('rejects when collected values do not match', async () => {
    const error = await expectPromise(
      collectAsyncIterable(
        expectMatchingAsyncIterablesConcurrently([
          source([{ value: 1 }]),
          source([{ value: 2 }]),
        ]),
      ),
    ).toReject();

    expect(error).to.be.an.instanceOf(Error);
    expect(error).to.have.property('message').that.contains('deeply equal');
  });

  it('rejects when a comparison iterable has extra values', async () => {
    const error = await expectPromise(
      collectAsyncIterable(
        expectMatchingAsyncIterablesConcurrently([
          source([1]),
          source([1, 2, 3]),
        ]),
      ),
    ).toReject();

    expect(error).to.be.an.instanceOf(Error);
    expect(error).to.have.property('message').that.contains('deeply equal');
  });

  it('can compare transformed value batches', async () => {
    const iterator = expectMatchingAsyncIterablesConcurrently(
      [source([1, 2]), source([2, 1])],
      (valueBatches) => {
        expect(
          valueBatches.map((values) => [...values].sort((a, b) => a - b)),
        ).to.deep.equal([
          [1, 2],
          [1, 2],
        ]);
      },
    );

    expect(await collectAsyncIterable(iterator)).to.deep.equal([1, 2]);
  });

  it('starts comparison iterators without delaying yielded values', async () => {
    let comparisonNextCallCount = 0;
    let resolveComparisonNext:
      | ((result: IteratorResult<number>) => void)
      | undefined;
    const comparison = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            comparisonNextCallCount += 1;
            return new Promise<IteratorResult<number>>((resolve) => {
              resolveComparisonNext = resolve;
            });
          },
          return() {
            resolveComparisonNext?.({ done: true, value: undefined });
            return Promise.resolve({ done: true, value: undefined });
          },
        };
      },
    };

    const iterator = expectMatchingAsyncIterablesConcurrently([
      source([1]),
      comparison,
    ]);

    expect(await iterator.next()).to.deep.equal({ done: false, value: 1 });
    expect(comparisonNextCallCount).to.equal(1);
    await iterator.return();
  });

  it('closes comparison iterators when the result is closed', async () => {
    let firstClosed = false;
    let secondClosed = false;
    const first = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.resolve({ done: false, value: 1 });
          },
          return() {
            firstClosed = true;
            return Promise.resolve({ done: true, value: undefined });
          },
        };
      },
    };
    const second = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.resolve({ done: false, value: 1 });
          },
          return() {
            secondClosed = true;
            return Promise.resolve({ done: true, value: undefined });
          },
        };
      },
    };

    const iterator = expectMatchingAsyncIterablesConcurrently([first, second]);

    expect(await iterator.next()).to.deep.equal({ done: false, value: 1 });
    await iterator.return();

    expect(firstClosed).to.equal(true);
    expect(secondClosed).to.equal(true);
  });

  it('returns done after concurrent comparison has completed', async () => {
    const iterator = expectMatchingAsyncIterablesConcurrently([
      source([1]),
      source([1]),
    ]);

    expect(await iterator.next()).to.deep.equal({ done: false, value: 1 });
    expect(await iterator.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
    expect(await iterator.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

  it('throws when concurrent source iterators do not implement throw', async () => {
    let comparisonClosed = false;
    const sourceWithoutThrow = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.resolve({ value: 1, done: false });
          },
        };
      },
    };
    const comparisonWithoutThrow = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.resolve({ value: 1, done: false });
          },
          return() {
            comparisonClosed = true;
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    };
    const iterator = expectMatchingAsyncIterablesConcurrently([
      sourceWithoutThrow,
      comparisonWithoutThrow,
    ]);

    await expectPromise(iterator.throw(new Error('thrown'))).toRejectWith(
      'thrown',
    );

    expect(comparisonClosed).to.equal(true);
  });
});
