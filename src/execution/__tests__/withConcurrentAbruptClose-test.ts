import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../../__testUtils__/expectPromise.js';

import { withConcurrentAbruptClose } from '../withConcurrentAbruptClose.js';

/* eslint-disable @typescript-eslint/require-await */
describe('withConcurrentAbruptClose', () => {
  it('calls function when returned', async () => {
    async function* source() {
      yield 1;
    }

    let done = false;

    const generator = withConcurrentAbruptClose(source(), () => {
      done = true;
    });

    expect(await generator.next()).to.deep.equal({ value: 1, done: false });
    expect(done).to.equal(false);
    expect(await generator.return()).to.deep.equal({
      value: undefined,
      done: true,
    });
    expect(done).to.equal(true);
  });

  it('ignores sync errors when returned', async () => {
    async function* source() {
      yield 1;
    }

    const generator = withConcurrentAbruptClose(source(), () => {
      throw new Error('Oops');
    });

    expect(await generator.next()).to.deep.equal({ value: 1, done: false });
    expect(await generator.return()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('ignores async errors when returned', async () => {
    async function* source() {
      yield 1;
    }

    const generator = withConcurrentAbruptClose(source(), () =>
      Promise.reject(new Error('Oops')),
    );

    expect(await generator.next()).to.deep.equal({ value: 1, done: false });
    expect(await generator.return()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('calls function when thrown', async () => {
    async function* source() {
      yield 1;
    }

    let done = false;
    let error;
    const generator = withConcurrentAbruptClose(
      source(),
      () => {
        done = true;
      },
      (err) => {
        done = true;
        error = err;
      },
    );

    expect(await generator.next()).to.deep.equal({ value: 1, done: false });
    expect(done).to.equal(false);
    const oops = new Error('Oops');
    await expectPromise(generator.throw(oops)).toRejectWith('Oops');
    expect(done).to.equal(true);
    expect(error).to.equal(oops);
  });

  it('ignores sync errors when thrown', async () => {
    async function* source() {
      yield 1;
    }

    const generator = withConcurrentAbruptClose(
      source(),
      () => {
        throw new Error('Ignored');
      },
      () => {
        throw new Error('Ignored');
      },
    );

    expect(await generator.next()).to.deep.equal({ value: 1, done: false });
    const oops = new Error('Oops');
    await expectPromise(generator.throw(oops)).toRejectWith('Oops');
  });

  it('ignores async errors when thrown', async () => {
    async function* source() {
      yield 1;
    }

    const generator = withConcurrentAbruptClose(
      source(),
      () => Promise.reject(new Error('Ignored')),
      () => Promise.reject(new Error('Ignored')),
    );

    expect(await generator.next()).to.deep.equal({ value: 1, done: false });
    const oops = new Error('Oops');
    await expectPromise(generator.throw(oops)).toRejectWith('Oops');
  });

  it('calls cleanup function when disposed', async () => {
    let returned = false;

    const items = [1, 2, 3];
    const source: AsyncGenerator<number, void, void> = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next(): Promise<IteratorResult<number, void>> {
        const value = items.shift();
        if (value !== undefined) {
          return Promise.resolve({ done: false, value });
        }

        return Promise.resolve({ done: true, value: undefined });
      },
      return(): Promise<IteratorResult<number, void>> {
        returned = true;
        return Promise.resolve({ done: true, value: undefined });
      },
      throw(): Promise<IteratorResult<number, void>> {
        returned = true;
        return Promise.reject(new Error());
      },
      async [Symbol.asyncDispose]() {
        await this.return();
      },
    };

    let called = false;
    {
      await using generator = withConcurrentAbruptClose(source, () => {
        called = true;
      });

      expect(await generator.next()).to.deep.equal({ value: 1, done: false });
      expect(await generator.next()).to.deep.equal({ value: 2, done: false });
    }

    expect(called).to.equal(true);
    expect(returned).to.equal(true);
  });

  it('returns the generator itself when the `Symbol.asyncIterator` method is called', async () => {
    async function* source() {
      yield 1;
    }

    const generator = withConcurrentAbruptClose(source(), () => {
      /* noop */
    });

    expect(generator[Symbol.asyncIterator]()).to.equal(generator);
  });

  it('awaits beforeThrow so an abrupt close can set the rejection reason', async () => {
    const abortReason = new Error('aborted');
    let storedReason: unknown;

    const generator = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        return Promise.resolve({ value: undefined, done: true });
      },
      throw() {
        return storedReason === undefined
          ? Promise.resolve({ value: undefined, done: true })
          : // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            Promise.reject(storedReason);
      },
      return() {
        return Promise.resolve({ value: undefined, done: true });
      },
      async [Symbol.asyncDispose]() {
        await this.return();
      },
    };

    const wrapped = withConcurrentAbruptClose(
      generator,
      () => undefined,
      async () => {
        await Promise.resolve();
        storedReason = abortReason;
      },
    );

    await expectPromise(wrapped.throw(abortReason)).toRejectWith('aborted');
    expect(storedReason).to.equal(abortReason);
  });
});
