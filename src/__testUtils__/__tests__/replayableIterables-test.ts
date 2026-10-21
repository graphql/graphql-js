import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectPromise } from '../expectPromise.ts';
import {
  createReplayableAsyncIterablePair,
  createReplayableIterablePair,
} from '../replayableIterables.ts';

async function collectAsyncIterable<T>(
  iterable: AsyncIterable<T>,
): Promise<ReadonlyArray<T>> {
  const values = [];
  for await (const value of iterable) {
    values.push(value);
  }
  return values;
}

describe('createReplayableIterablePair', () => {
  it('replays recorded iterable values', () => {
    function* source() {
      yield { value: 1 };
      yield { value: 2 };
    }

    const [recordingIterable, replayIterable] =
      createReplayableIterablePair(source());

    expect(Array.from(recordingIterable)).to.deep.equal([
      { value: 1 },
      { value: 2 },
    ]);
    expect(Array.from(replayIterable)).to.deep.equal([
      { value: 1 },
      { value: 2 },
    ]);
    expect(Array.from(replayIterable)).to.deep.equal([
      { value: 1 },
      { value: 2 },
    ]);
  });

  it('throws when replayed before recording completes', () => {
    const [recordingIterable, replayIterable] = createReplayableIterablePair([
      1, 2,
    ]);
    const recordingIterator = recordingIterable[Symbol.iterator]();

    expect(recordingIterator.next()).to.deep.equal({ done: false, value: 1 });
    expect(() => Array.from(replayIterable)).to.throw(
      'Expected iterable input to be recorded before replaying it.',
    );
  });

  it('replays recorded iterable errors', () => {
    function* source() {
      yield 1;
      throw new Error('bad iterator');
    }

    const [recordingIterable, replayIterable] =
      createReplayableIterablePair(source());
    const recordingIterator = recordingIterable[Symbol.iterator]();
    const replayIterator = replayIterable[Symbol.iterator]();

    expect(recordingIterator.next()).to.deep.equal({ done: false, value: 1 });
    expect(() => recordingIterator.next()).to.throw('bad iterator');

    expect(replayIterator.next()).to.deep.equal({ done: false, value: 1 });
    expect(() => replayIterator.next()).to.throw('bad iterator');
  });

  it('replays iterator completion after early return', () => {
    let closed = false;
    function* source() {
      try {
        yield 1;
        yield 2;
      } finally {
        closed = true;
      }
    }

    const [recordingIterable, replayIterable] =
      createReplayableIterablePair(source());
    const recordingIterator = recordingIterable[Symbol.iterator]();

    expect(recordingIterator.next()).to.deep.equal({ done: false, value: 1 });
    expect(recordingIterator.return?.()).to.deep.equal({
      done: true,
      value: undefined,
    });
    expect(recordingIterator.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
    expect(recordingIterator.return?.()).to.deep.equal({
      done: true,
      value: undefined,
    });

    expect(closed).to.equal(true);
    expect(Array.from(replayIterable)).to.deep.equal([1]);
  });

  it('replays iterator completion when return is not implemented', () => {
    const recordingSource = {
      [Symbol.iterator]() {
        return {
          next() {
            return { done: false, value: 1 };
          },
        };
      },
    };
    const [recordingIterable, replayIterable] =
      createReplayableIterablePair(recordingSource);
    const recordingIterator = recordingIterable[Symbol.iterator]();

    expect(recordingIterator.next()).to.deep.equal({ done: false, value: 1 });
    expect(recordingIterator.return?.()).to.deep.equal({
      done: true,
      value: undefined,
    });
    expect(Array.from(replayIterable)).to.deep.equal([1]);
  });
});

describe('createReplayableAsyncIterablePair', () => {
  it('replays recorded async iterable values', async () => {
    async function* source() {
      await Promise.resolve();
      yield { value: 1 };
      yield { value: 2 };
    }

    const [recordingIterable, replayIterable] =
      createReplayableAsyncIterablePair(source());

    expect(await collectAsyncIterable(recordingIterable)).to.deep.equal([
      { value: 1 },
      { value: 2 },
    ]);
    expect(await collectAsyncIterable(replayIterable)).to.deep.equal([
      { value: 1 },
      { value: 2 },
    ]);
    expect(await collectAsyncIterable(replayIterable)).to.deep.equal([
      { value: 1 },
      { value: 2 },
    ]);
  });

  it('rejects when replayed before recording completes', async () => {
    async function* source() {
      await Promise.resolve();
      yield 1;
      yield 2;
    }

    const [recordingIterable, replayIterable] =
      createReplayableAsyncIterablePair(source());
    const recordingIterator = recordingIterable[Symbol.asyncIterator]();

    expect(await recordingIterator.next()).to.deep.equal({
      done: false,
      value: 1,
    });
    await expectPromise(collectAsyncIterable(replayIterable)).toRejectWith(
      'Expected async iterable input to be recorded before replaying it.',
    );
  });

  it('replays recorded async iterable errors', async () => {
    async function* source() {
      await Promise.resolve();
      yield 1;
      throw new Error('bad iterator');
    }

    const [recordingIterable, replayIterable] =
      createReplayableAsyncIterablePair(source());
    const recordingIterator = recordingIterable[Symbol.asyncIterator]();
    const replayIterator = replayIterable[Symbol.asyncIterator]();

    expect(await recordingIterator.next()).to.deep.equal({
      done: false,
      value: 1,
    });
    await expectPromise(recordingIterator.next()).toRejectWith('bad iterator');

    expect(await replayIterator.next()).to.deep.equal({
      done: false,
      value: 1,
    });
    await expectPromise(replayIterator.next()).toRejectWith('bad iterator');
  });

  it('replays async iterator completion after early return', async () => {
    let closed = false;
    async function* source() {
      await Promise.resolve();
      try {
        yield 1;
        yield 2;
      } finally {
        closed = true;
      }
    }

    const [recordingIterable, replayIterable] =
      createReplayableAsyncIterablePair(source());
    const recordingIterator = recordingIterable[Symbol.asyncIterator]();

    expect(await recordingIterator.next()).to.deep.equal({
      done: false,
      value: 1,
    });
    expect(await recordingIterator.return?.()).to.deep.equal({
      done: true,
      value: undefined,
    });
    expect(await recordingIterator.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
    expect(await recordingIterator.return?.()).to.deep.equal({
      done: true,
      value: undefined,
    });

    expect(closed).to.equal(true);
    expect(await collectAsyncIterable(replayIterable)).to.deep.equal([1]);
  });

  it('replays async iterator completion when return is not implemented', async () => {
    const recordingSource = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.resolve({ done: false, value: 1 });
          },
        };
      },
    };
    const [recordingIterable, replayIterable] =
      createReplayableAsyncIterablePair(recordingSource);
    const recordingIterator = recordingIterable[Symbol.asyncIterator]();

    expect(await recordingIterator.next()).to.deep.equal({
      done: false,
      value: 1,
    });
    expect(await recordingIterator.return?.()).to.deep.equal({
      done: true,
      value: undefined,
    });
    expect(await collectAsyncIterable(replayIterable)).to.deep.equal([1]);
  });
});
