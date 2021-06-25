import { expect } from 'chai';
import { describe, it } from 'mocha';

import { MaybePromise } from '../maybePromise';

describe('MaybePromise', () => {
  it('is a class with no public member properties', () => {
    const maybePromise = new MaybePromise(() => 5);
    expect(maybePromise).to.be.instanceof(MaybePromise);
    expect(maybePromise).to.include({});
  });

  it('works when instantiated with a value', () => {
    const maybePromise = new MaybePromise(() => 5);

    const value = maybePromise.resolve();
    expect(value).to.equal(5);
  });

  it('works on initial throw', () => {
    const maybePromise = new MaybePromise(() => {
      throw new Error('Error');
    });
    expect(() => maybePromise.resolve()).to.throw('Error');
  });

  it('works when instantiated with a promise', async () => {
    const maybePromise = new MaybePromise(() => Promise.resolve(5));

    const promise = maybePromise.resolve();
    expect(await promise).to.equal(5);
  });

  it('works when instantiated with a promise that rejects', async () => {
    const e = new Error('Error');
    const maybePromise = new MaybePromise(() => Promise.reject(e));

    try {
      await maybePromise.resolve();
      // istanbul ignore next (Shouldn't be reached)
      throw new Error('Promise should reject.');
    } catch (error) {
      expect(error).to.equal(e);
    }
  });

  it('works when calling then on a promise', async () => {
    const maybePromise = new MaybePromise(() => Promise.resolve(5)).then(
      (x) => x + 1,
    );
    expect(await maybePromise.resolve()).to.equal(6);
  });

  it('works when calling catch on a promise', async () => {
    const e = new Error('Error');
    const maybePromise = new MaybePromise(() => Promise.reject(e)).catch(
      (error) => error,
    );
    expect(await maybePromise.resolve()).to.equal(e);
  });

  it('works when calling then on a value', () => {
    const maybePromise = new MaybePromise(() => 5).then((x) => x + 1);
    expect(maybePromise.resolve()).to.equal(6);
  });

  it('works when calling catch on a value', () => {
    const e = new Error('Error');
    const maybePromise = new MaybePromise(() => {
      throw e;
    }).catch((error) => error);
    expect(maybePromise.resolve()).to.equal(e);
  });

  it('works when calling then with undefined', () => {
    const maybePromise = new MaybePromise(() => 5).then();
    expect(maybePromise.resolve()).to.equal(5);
  });

  it('works when throwing from then', () => {
    const e = new Error('Error');
    const maybePromise = new MaybePromise(() => 5).then(() => {
      throw e;
    });
    expect(() => maybePromise.resolve()).to.throw(e);
  });

  it('works with MaybePromise.all for values', () => {
    const maybePromise1 = new MaybePromise(() => 1);
    const maybePromise2 = new MaybePromise(() => 2);
    const all = MaybePromise.all([maybePromise1, maybePromise2]);
    expect(all.resolve()).to.deep.equal([1, 2]);
  });

  it('works with MaybePromise.all for promises', async () => {
    const maybePromise1 = new MaybePromise(() => Promise.resolve(1));
    const maybePromise2 = new MaybePromise(() => Promise.resolve(2));
    const all = MaybePromise.all([maybePromise1, maybePromise2]);
    expect(await all.resolve()).to.deep.equal([1, 2]);
  });

  it('works with MaybePromise.all for mixture of values and promises', async () => {
    const maybePromise1 = new MaybePromise(() => 1);
    const maybePromise2 = new MaybePromise(() => Promise.resolve(2));
    const all = MaybePromise.all([maybePromise1, maybePromise2]);
    expect(await all.resolve()).to.deep.equal([1, 2]);
  });

  it('works with MaybePromise.all with a promise that rejects', async () => {
    const e = new Error('Error');
    const maybePromise1 = new MaybePromise(() => 1);
    const maybePromise2 = new MaybePromise(() => Promise.reject(e));
    const all = MaybePromise.all([maybePromise1, maybePromise2]);
    try {
      await all.resolve();
      // istanbul ignore next (Shouldn't be reached)
      throw new Error('Promise should reject.');
    } catch (error) {
      expect(error).to.equal(e);
    }
  });

  it('works with MaybePromise.all with a value that throws', async () => {
    const e = new Error('Error');
    const maybePromise1 = new MaybePromise(() => 1);
    const maybePromise2 = new MaybePromise(() => {
      throw e;
    });
    const all = MaybePromise.all([maybePromise1, maybePromise2]);
    try {
      await all.resolve();
      // istanbul ignore next (Shouldn't be reached)
      throw new Error('Promise should reject.');
    } catch (error) {
      expect(error).to.equal(e);
    }
  });
});
