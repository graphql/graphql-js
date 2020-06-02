import { expect } from 'chai';
import { describe, it } from 'mocha';

import { PromiseOrValue } from '../../jsutils/PromiseOrValue';

import invariant from '../../jsutils/invariant';

import mapAsyncIterator from '../mapAsyncIterator';

describe('mapAsyncIterator', () => {
  it('maps over async generator', async () => {
    // FIXME: Missing await
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

  it('maps over async iterator', async () => {
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

    const doubles = mapAsyncIterator(iterator, (x: number) => x + x);

    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 4, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 6, done: false });
    expect(await doubles.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('compatible with for-await-of', async () => {
    // FIXME: Missing await
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
    // FIXME: Missing await
    async function* source() {
      yield 1;
      yield 2;
      yield 3;
    }

    // Flow test: this is *not* AsyncIterator<Promise<number>>
    const doubles: AsyncIterator<number> = mapAsyncIterator(
      source(),
      // FIXME: Unknown type of x
      async (x) => (await x) + x,
    );

    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 4, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 6, done: false });
    expect(await doubles.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('allows returning early from mapped async generator', async () => {
    // FIXME: Missing await
    async function* source() {
      yield 1;
      yield 2;

      // istanbul ignore next (Shouldn't be reached)
      yield 3;
    }

    const doubles = mapAsyncIterator(source(), (x) => x + x);

    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 4, done: false });

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

  it('allows returning early from mapped async iterator', async () => {
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

    const doubles = mapAsyncIterator(iterator, (x: number) => x + x);

    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 4, done: false });

    // Early return
    expect(await doubles.return()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('passes through early return from async values', async () => {
    // FIXME: Missing await
    async function* source() {
      try {
        yield 1;
        yield 2;

        // istanbul ignore next (Shouldn't be reached)
        yield 3;
      } finally {
        yield 'Done';
        yield 'Last';
      }
    }

    // @ts-expect-error - we are trying to combine number and string with + operand
    const doubles = mapAsyncIterator(source(), (x: number | string) => x + x);

    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 4, done: false });

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

  it('allows throwing errors through async iterators', async () => {
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

    const doubles = mapAsyncIterator(iterator, (x: number) => x + x);

    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 4, done: false });

    // Throw error
    let caughtError;
    try {
      await doubles.throw('ouch');
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).to.equal('ouch');
  });

  it('passes through caught errors through async generators', async () => {
    // FIXME: Missing await
    async function* source() {
      try {
        yield 1;
        yield 2;

        // istanbul ignore next (Shouldn't be reached)
        yield 3;
      } catch (e) {
        yield e;
      }
    }

    const doubles = mapAsyncIterator(source(), (x: number) => x + x);

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
    // FIXME: Missing await
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
      await doubles.next();
    } catch (e) {
      caughtError = e;
    }

    invariant(caughtError != null);
    expect(caughtError.message).to.equal('Goodbye');
  });

  it('maps over thrown errors if second callback provided', async () => {
    // FIXME: Missing await
    async function* source() {
      yield 'Hello';
      throw new Error('Goodbye');
    }

    const doubles = mapAsyncIterator(
      source(),
      (x) => x + x,
      (error) => error,
    );

    expect(await doubles.next()).to.deep.equal({
      value: 'HelloHello',
      done: false,
    });

    const result = await doubles.next();
    invariant(result.value instanceof Error);
    expect(result.value.message).to.equal('Goodbye');
    expect(result.done).to.equal(false);

    expect(await doubles.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  async function testClosesSourceWithMapper(
    mapper: (v: number) => PromiseOrValue<number>,
  ) {
    let didVisitFinally = false;

    // FIXME: Missing await
    async function* source() {
      try {
        yield 1;
        yield 2;

        // istanbul ignore next (Shouldn't be reached)
        yield 3;
      } finally {
        didVisitFinally = true;
        yield 1000;
      }
    }

    const throwOver1 = mapAsyncIterator(source(), mapper);

    expect(await throwOver1.next()).to.deep.equal({ value: 1, done: false });

    let expectedError;
    try {
      await throwOver1.next();
    } catch (error) {
      expectedError = error;
    }

    invariant(expectedError instanceof Error);
    expect(expectedError.message).to.equal('Cannot count to 2');

    expect(await throwOver1.next()).to.deep.equal({
      value: undefined,
      done: true,
    });

    expect(didVisitFinally).to.equal(true);
  }

  it('closes source if mapper throws an error', async () => {
    await testClosesSourceWithMapper((x: number) => {
      if (x > 1) {
        // FIXME: Prefer string literal over plus operand
        throw new Error('Cannot count to ' + x);
      }
      return x;
    });
  });

  it('closes source if mapper rejects', async () => {
    await testClosesSourceWithMapper((x: number) =>
      x > 1
        ? // FIXME: Prefer string literal over plus operand
          Promise.reject(new Error('Cannot count to ' + x))
        : Promise.resolve(x),
    );
  });

  async function testClosesSourceWithRejectMapper(
    mapper: (e: Error) => PromiseOrValue<number>,
  ) {
    // FIXME: Missing await
    async function* source() {
      yield 1;
      throw new Error('2');
    }

    const throwOver1 = mapAsyncIterator(source(), (x: number) => x, mapper);

    expect(await throwOver1.next()).to.deep.equal({ value: 1, done: false });

    let expectedError;
    try {
      await throwOver1.next();
    } catch (error) {
      expectedError = error;
    }

    invariant(expectedError instanceof Error);
    expect(expectedError.message).to.equal('Cannot count to 2');

    expect(await throwOver1.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  }

  it('closes source if mapper throws an error', async () => {
    await testClosesSourceWithRejectMapper((error: Error) => {
      throw new Error('Cannot count to ' + error.message);
    });
  });

  it('closes source if mapper rejects', async () => {
    await testClosesSourceWithRejectMapper((error: Error) =>
      Promise.reject(new Error('Cannot count to ' + error.message)),
    );
  });
});
