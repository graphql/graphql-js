import { expect } from 'chai';
import { describe, it } from 'mocha';

import flattenAsyncIterator from '../flattenAsyncIterator';

describe('flattenAsyncIterator', () => {
  it('does not modify an already flat async generator', async () => {
    async function* source() {
      yield 1;
      yield 2;
      yield 3;
    }

    const result = flattenAsyncIterator(source());

    expect(await result.next()).to.deep.equal({ value: 1, done: false });
    expect(await result.next()).to.deep.equal({ value: 2, done: false });
    expect(await result.next()).to.deep.equal({ value: 3, done: false });
    expect(await result.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('does not modify an already flat async iterator', async () => {
    const items = [1, 2, 3];

    const iterator: any = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        return Promise.resolve({
          done: items.length === 0,
          value: items.shift(),
        });
      },
    };

    const result = flattenAsyncIterator(iterator);

    expect(await result.next()).to.deep.equal({ value: 1, done: false });
    expect(await result.next()).to.deep.equal({ value: 2, done: false });
    expect(await result.next()).to.deep.equal({ value: 3, done: false });
    expect(await result.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('flatten nested async generators', async () => {
    async function* source() {
      yield 1;
      yield 2;
      yield (async function* (): AsyncGenerator<number, void, void> {
        yield 2.1;
        yield 2.2;
      })();
      yield 3;
    }

    const doubles = flattenAsyncIterator(source());

    const result = [];
    for await (const x of doubles) {
      result.push(x);
    }
    expect(result).to.deep.equal([1, 2, 2.1, 2.2, 3]);
  });

  it('allows returning early from a nested async generator', async () => {
    async function* source() {
      yield 1;
      yield 2;
      yield (async function* (): AsyncGenerator<number, void, void> {
        yield 2.1;
        // istanbul ignore next (Shouldn't be reached)
        yield 2.2;
      })();
      // istanbul ignore next (Shouldn't be reached)
      yield 3;
    }

    const doubles = flattenAsyncIterator(source());

    expect(await doubles.next()).to.deep.equal({ value: 1, done: false });
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

  it('allows throwing errors from a nested async generator', async () => {
    async function* source() {
      yield 1;
      yield 2;
      yield (async function* (): AsyncGenerator<number, void, void> {
        yield 2.1;
        // istanbul ignore next (Shouldn't be reached)
        yield 2.2;
      })();
      // istanbul ignore next (Shouldn't be reached)
      yield 3;
    }

    const doubles = flattenAsyncIterator(source());

    expect(await doubles.next()).to.deep.equal({ value: 1, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 2.1, done: false });

    // Throw error
    let caughtError;
    try {
      await doubles.throw('ouch');
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).to.equal('ouch');
  });
});
