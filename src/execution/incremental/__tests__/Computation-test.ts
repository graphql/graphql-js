import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../../../__testUtils__/expectPromise.js';
import { resolveOnNextTick } from '../../../__testUtils__/resolveOnNextTick.js';

import { isPromise } from '../../../jsutils/isPromise.js';

import { Computation } from '../Computation.js';

function abortIgnoringCleanup(
  computation: Computation<unknown>,
  reason?: unknown,
): void {
  const aborted = computation.abort(reason);
  if (isPromise(aborted)) {
    aborted.catch(() => undefined);
  }
}

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
      // eslint-disable-next-line @typescript-eslint/await-thenable
      computation.prime(),
      // eslint-disable-next-line @typescript-eslint/await-thenable
      computation.prime(),
      // eslint-disable-next-line @typescript-eslint/await-thenable
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
      // eslint-disable-next-line @typescript-eslint/await-thenable
      computation.prime(),
      // eslint-disable-next-line @typescript-eslint/await-thenable
      computation.prime(),
      // eslint-disable-next-line @typescript-eslint/await-thenable
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

  it('can be aborted before running', () => {
    let onAbortRan = false;
    const computation = new Computation(
      () => ({ value: 123 }),
      () => {
        onAbortRan = true;
      },
    );
    abortIgnoringCleanup(computation);
    expect(() => computation.result()).to.throw('Cancelled!');
    expect(onAbortRan).to.equal(false);
  });

  it('cannot be aborted after running synchronously', () => {
    let onAbortRan = false;
    const computation = new Computation(
      () => ({ value: 123 }),
      () => {
        onAbortRan = true;
      },
    );

    computation.prime();
    abortIgnoringCleanup(computation);
    expect(computation.result()).to.deep.equal({ value: 123 });
    expect(onAbortRan).to.equal(false);
  });

  it('cannot be aborted after erroring synchronously', () => {
    let onAbortRan = false;
    const computation = new Computation(
      () => {
        throw new Error('failure');
      },
      () => {
        onAbortRan = true;
      },
    );

    computation.prime();
    abortIgnoringCleanup(computation);
    expect(() => computation.result()).to.throw('failure');
    expect(onAbortRan).to.equal(false);
  });

  it('can be aborted while running asynchronously', () => {
    let onAbortRan = false;
    const computation = new Computation(
      () =>
        new Promise(() => {
          // Never resolves.
        }),
      () => {
        onAbortRan = true;
      },
    );

    computation.prime();
    abortIgnoringCleanup(computation);
    expect(onAbortRan).to.equal(true);
    expect(() => computation.result()).to.throw('Cancelled!');
  });

  it('returns async abort cleanup while running', async () => {
    let resolveCleanup!: () => void;
    const cleanupPromise = new Promise<void>((resolve) => {
      resolveCleanup = resolve;
    });
    const computation = new Computation(
      () =>
        new Promise(() => {
          // Never resolves.
        }),
      () => cleanupPromise,
    );

    computation.prime();
    const abortResult = computation.abort();
    expect(abortResult).to.equal(cleanupPromise);
    expect(isPromise(abortResult)).to.equal(true);
    if (!isPromise(abortResult)) {
      throw new Error('Expected async abort cleanup promise.');
    }

    let abortSettled = false;
    abortResult.then(
      () => {
        abortSettled = true;
      },
      () => {
        abortSettled = true;
      },
    );
    expect(abortSettled).to.equal(false);
    resolveCleanup();
    await abortResult;
    expect(abortSettled).to.equal(true);
  });

  it('can be aborted with a provided reason before running', () => {
    const abortReason = new Error('aborted');
    const computation = new Computation(() => ({ value: 123 }));

    abortIgnoringCleanup(computation, abortReason);
    expect(() => computation.result()).to.throw('aborted');
  });

  it('forwards abort reason to onAbort while running asynchronously', () => {
    const abortReason = new Error('aborted');
    let onAbortReason: unknown;
    const computation = new Computation(
      () =>
        new Promise(() => {
          // Never resolves.
        }),
      (reason) => {
        onAbortReason = reason;
      },
    );

    computation.prime();
    abortIgnoringCleanup(computation, abortReason);
    expect(onAbortReason).to.equal(abortReason);
    expect(() => computation.result()).to.throw('aborted');
  });
});
