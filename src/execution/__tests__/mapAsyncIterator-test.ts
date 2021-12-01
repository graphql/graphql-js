import { expect } from 'chai';
import { describe, it } from 'mocha';

import { mapAsyncIterator } from '../mapAsyncIterator';

/* eslint-disable @typescript-eslint/require-await */
describe('mapAsyncIterator', () => {
  it('maps over async generator', async () => {
    async function* source() {
      yield 1;
      yield 2;
      yield 3;
    }

    const doubles = mapAsyncIterator(source(), (x) => x + x);

    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 4, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 6, done: false });
    expect(await doubles.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('maps over async iterable', async () => {
    const items = [1, 2, 3];

    const iterable = {
      [Symbol.asyncIterator]() {
        return this;
      },

      next(): Promise<IteratorResult<number, void>> {
        if (items.length > 0) {
          const value = items[0];
          items.shift();
          return Promise.resolve({ done: false, value });
        }

        return Promise.resolve({ done: true, value: undefined });
      },
    };

    const doubles = mapAsyncIterator(iterable, (x) => x + x);

    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 4, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 6, done: false });
    expect(await doubles.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('compatible with for-await-of', async () => {
    async function* source() {
      yield 1;
      yield 2;
      yield 3;
    }

    const doubles = mapAsyncIterator(source(), (x) => x + x);

    const result = [];
    for await (const x of doubles) {
      result.push(x);
    }
    expect(result).to.deep.equal([2, 4, 6]);
  });

  it('maps over async values with async function', async () => {
    async function* source() {
      yield 1;
      yield 2;
      yield 3;
    }

    const doubles = mapAsyncIterator(source(), (x) => Promise.resolve(x + x));

    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 4, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 6, done: false });
    expect(await doubles.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('allows returning early from mapped async generator', async () => {
    async function* source() {
      try {
        yield 1;
        /* c8 ignore next 2 */
        yield 2;
        yield 3; // Shouldn't be reached.
      } finally {
        // eslint-disable-next-line no-unsafe-finally
        return 'The End';
      }
    }

    const doubles = mapAsyncIterator(source(), (x) => x + x);

    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 4, done: false });

    // Early return
    expect(await doubles.return('')).to.deep.equal({
      value: 'The End',
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

  it('allows returning early from mapped async iterable', async () => {
    const items = [1, 2, 3];

    const iterable = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        const value = items[0];
        items.shift();
        return Promise.resolve({
          done: items.length === 0,
          value,
        });
      },
    };

    const doubles = mapAsyncIterator(iterable, (x) => x + x);

    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 4, done: false });

    // Early return
    expect(await doubles.return(0)).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('passes through early return from async values', async () => {
    async function* source() {
      try {
        yield 'a';
        /* c8 ignore next 2 */
        yield 'b';
        yield 'c'; // Shouldn't be reached.
      } finally {
        yield 'Done';
        yield 'Last';
      }
    }

    const doubles = mapAsyncIterator(source(), (x) => x + x);

    expect(await doubles.next()).to.deep.equal({ value: 'aa', done: false });
    expect(await doubles.next()).to.deep.equal({ value: 'bb', done: false });

    // Early return
    expect(await doubles.return()).to.deep.equal({
      value: 'DoneDone',
      done: false,
    });

    // Subsequent next calls may yield from finally block
    expect(await doubles.next()).to.deep.equal({
      value: 'LastLast',
      done: false,
    });
    expect(await doubles.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('allows throwing errors through async iterable', async () => {
    const items = [1, 2, 3];

    const iterable = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        const value = items[0];
        items.shift();
        return Promise.resolve({
          done: items.length === 0,
          value,
        });
      },
    };

    const doubles = mapAsyncIterator(iterable, (x) => x + x);

    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 4, done: false });

    // Throw error
    let caughtError;
    try {
      /* c8 ignore next */
      await doubles.throw('ouch');
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).to.equal('ouch');
  });

  it('passes through caught errors through async generators', async () => {
    async function* source() {
      try {
        yield 1;
        /* c8 ignore next 2 */
        yield 2;
        yield 3; // Shouldn't be reached.
      } catch (e) {
        yield e;
      }
    }

    const doubles = mapAsyncIterator(source(), (x) => x + x);

    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 4, done: false });

    // Throw error
    expect(await doubles.throw('Ouch')).to.deep.equal({
      value: 'OuchOuch',
      done: false,
    });

    expect(await doubles.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
    expect(await doubles.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('does not normally map over thrown errors', async () => {
    async function* source() {
      yield 'Hello';
      throw new Error('Goodbye');
    }

    const doubles = mapAsyncIterator(source(), (x) => x + x);

    expect(await doubles.next()).to.deep.equal({
      value: 'HelloHello',
      done: false,
    });

    let caughtError;
    try {
      /* c8 ignore next */
      await doubles.next();
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError)
      .to.be.an.instanceOf(Error)
      .with.property('message', 'Goodbye');
  });

  async function testClosesSourceWithMapper<T>(mapper: (value: number) => T) {
    let didVisitFinally = false;

    async function* source() {
      try {
        yield 1;
        /* c8 ignore next 2 */
        yield 2;
        yield 3; // Shouldn't be reached.
      } finally {
        didVisitFinally = true;
        yield 1000;
      }
    }

    const throwOver1 = mapAsyncIterator(source(), mapper);

    expect(await throwOver1.next()).to.deep.equal({ value: 1, done: false });

    let expectedError;
    try {
      /* c8 ignore next */
      await throwOver1.next();
    } catch (error) {
      expectedError = error;
    }

    expect(expectedError)
      .to.be.an.instanceOf(Error)
      .with.property('message', 'Cannot count to 2');

    expect(await throwOver1.next()).to.deep.equal({
      value: undefined,
      done: true,
    });

    expect(didVisitFinally).to.equal(true);
  }

  it('closes source if mapper throws an error', async () => {
    await testClosesSourceWithMapper((x) => {
      if (x > 1) {
        throw new Error('Cannot count to ' + x);
      }
      return x;
    });
  });

  it('closes source if mapper rejects', async () => {
    await testClosesSourceWithMapper((x) =>
      x > 1
        ? Promise.reject(new Error('Cannot count to ' + x))
        : Promise.resolve(x),
    );
  });
});
