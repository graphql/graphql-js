import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../../__testUtils__/expectPromise.js';

import { withCleanup } from '../withCleanup.js';

/* eslint-disable @typescript-eslint/require-await */
describe('withCleanup', () => {
  it('calls cleanup function when completes', async () => {
    async function* source() {
      yield 1;
    }

    let done = false;
    const generator = withCleanup(source(), () => {
      done = true;
    });

    expect(await generator.next()).to.deep.equal({ value: 1, done: false });
    expect(done).to.equal(false);
    expect(await generator.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
    expect(done).to.equal(true);
  });

  it('calls cleanup function when completes with error', async () => {
    async function* source() {
      yield 1;
      throw new Error('Oops');
    }

    let done = false;
    const generator = withCleanup(source(), () => {
      done = true;
    });

    expect(await generator.next()).to.deep.equal({ value: 1, done: false });
    expect(done).to.equal(false);
    await expectPromise(generator.next()).toRejectWith('Oops');
    expect(done).to.equal(true);
  });

  it('calls cleanup function when returned', async () => {
    async function* source() {
      yield 1;
    }

    let done = false;
    const generator = withCleanup(source(), () => {
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

  it('calls cleanup function when thrown', async () => {
    async function* source() {
      yield 1;
    }

    let done = false;
    const generator = withCleanup(source(), () => {
      done = true;
    });

    expect(await generator.next()).to.deep.equal({ value: 1, done: false });
    expect(done).to.equal(false);
    await expectPromise(generator.throw(new Error('Oops'))).toRejectWith(
      'Oops',
    );
    expect(done).to.equal(true);
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

    let cleanedUp = false;
    {
      await using generator = withCleanup(source, () => {
        cleanedUp = true;
      });

      expect(await generator.next()).to.deep.equal({ value: 1, done: false });
      expect(await generator.next()).to.deep.equal({ value: 2, done: false });
    }

    expect(cleanedUp).to.equal(true);
    expect(returned).to.equal(true);
  });

  it('returns the generator itself when the `Symbol.asyncIterator` method is called', async () => {
    async function* source() {
      yield 1;
    }

    const generator = withCleanup(source(), () => {
      /* noop */
    });

    expect(generator[Symbol.asyncIterator]()).to.equal(generator);
  });
});
