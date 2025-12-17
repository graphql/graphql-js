import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../../../__testUtils__/expectPromise.js';
import { resolveOnNextTick } from '../../../__testUtils__/resolveOnNextTick.js';

import { Computation } from '../Computation.js';

describe('Computation', () => {
  it('can return a result', () => {
    const computation = new Computation(() => ({ value: 123 }));

    expect(computation.result()).to.deep.equal({ value: 123 });
  });

  it('can be started manually', () => {
    const computation = new Computation(() => ({ value: 123 }));

    computation.prime();
    expect(computation.result()).to.deep.equal({ value: 123 });
  });

  it('only runs once when started multiple times', async () => {
    let runCount = 0;
    const computation = new Computation(() => {
      runCount++;
      return { value: 'done' };
    });

    await Promise.all([
      computation.prime(),
      computation.prime(),
      computation.prime(),
    ]);
    const results = [
      computation.result(),
      computation.result(),
      computation.result(),
    ];

    expect(results).to.deep.equal([
      { value: 'done' },
      { value: 'done' },
      { value: 'done' },
    ]);
    expect(runCount).to.equal(1);
  });

  it('stores async result via result()', async () => {
    let runCount = 0;
    const computation = new Computation(async () => {
      runCount++;
      await resolveOnNextTick();
      return { value: 'done' };
    });

    await Promise.all([
      computation.prime(),
      computation.prime(),
      computation.prime(),
    ]);
    const results = [
      computation.result(),
      computation.result(),
      computation.result(),
    ];

    expect(results).to.deep.equal([
      { value: 'done' },
      { value: 'done' },
      { value: 'done' },
    ]);
    expect(runCount).to.equal(1);
  });

  it('stores sync error in result()', () => {
    let runCount = 0;
    const computation = new Computation(() => {
      runCount++;
      throw new Error('failure');
    });

    expect(() => computation.prime()).to.not.throw();
    expect(() => computation.result()).to.throw('failure');
    expect(() => computation.result()).to.throw('failure');
    expect(runCount).to.equal(1);
  });

  it('stores async error in result()', async () => {
    let runCount = 0;
    const computation = new Computation(async () => {
      runCount++;
      await resolveOnNextTick();
      throw new Error('failure');
    });

    expect(() => computation.prime()).to.not.throw();
    await expectPromise(computation.result()).toRejectWith('failure');
    expect(() => computation.result()).to.throw('failure');
    expect(runCount).to.equal(1);
  });

  it('can be cancelled before running', () => {
    let onCancelRan = false;
    const computation = new Computation(
      () => ({ value: 123 }),
      () => {
        onCancelRan = true;
      },
    );
    computation.cancel();
    expect(() => computation.result()).to.throw('Cancelled!');
    expect(onCancelRan).to.equal(false);
  });

  it('cannot be cancelled after running synchronously', () => {
    let onCancelRan = false;
    const computation = new Computation(
      () => ({ value: 123 }),
      () => {
        onCancelRan = true;
      },
    );

    computation.prime();
    computation.cancel();
    expect(computation.result()).to.deep.equal({ value: 123 });
    expect(onCancelRan).to.equal(false);
  });

  it('cannot be cancelled after erroring synchronously', () => {
    let onCancelRan = false;
    const computation = new Computation(
      () => {
        throw new Error('failure');
      },
      () => {
        onCancelRan = true;
      },
    );

    computation.prime();
    computation.cancel();
    expect(() => computation.result()).to.throw('failure');
    expect(onCancelRan).to.equal(false);
  });

  it('can be cancelled while running asynchronously', () => {
    let onCancelRan = false;
    const computation = new Computation(
      () =>
        new Promise(() => {
          // Never resolves.
        }),
      () => {
        onCancelRan = true;
      },
    );

    computation.prime();
    computation.cancel();
    expect(onCancelRan).to.equal(true);
    expect(() => computation.result()).to.throw('Cancelled!');
  });
});
