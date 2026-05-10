import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../../../__testUtils__/expectPromise.ts';
import { resolveOnNextTick } from '../../../__testUtils__/resolveOnNextTick.ts';
import { spyOn } from '../../../__testUtils__/spyOn.ts';

import { isPromise } from '../../../jsutils/isPromise.ts';

import { Computation } from '../Computation.ts';

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
    const runSpy = spyOn(() => ({ value: 'done' }));
    const computation = new Computation(runSpy);

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
    expect(runSpy.callCount).to.equal(1);
  });

  it('stores async result via result()', async () => {
    const runSpy = spyOn(async () => {
      await resolveOnNextTick();
      return { value: 'done' };
    });
    const computation = new Computation(runSpy);

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
    expect(runSpy.callCount).to.equal(1);
  });

  it('stores sync error in result()', () => {
    const runSpy = spyOn(() => {
      throw new Error('failure');
    });
    const computation = new Computation(runSpy);

    expect(() => computation.prime()).to.not.throw();
    expect(() => computation.result()).to.throw('failure');
    expect(() => computation.result()).to.throw('failure');
    expect(runSpy.callCount).to.equal(1);
  });

  it('stores async error in result()', async () => {
    const runSpy = spyOn(async () => {
      await resolveOnNextTick();
      throw new Error('failure');
    });
    const computation = new Computation(runSpy);

    expect(() => computation.prime()).to.not.throw();
    await expectPromise(computation.result()).toRejectWith('failure');
    expect(() => computation.result()).to.throw('failure');
    expect(runSpy.callCount).to.equal(1);
  });

  it('can be aborted before running', () => {
    const onAbortSpy = spyOn(() => undefined);
    const computation = new Computation(() => ({ value: 123 }), onAbortSpy);
    abortIgnoringCleanup(computation);
    expect(() => computation.result()).to.throw('Cancelled!');
    expect(onAbortSpy.callCount).to.equal(0);
  });

  it('cannot be aborted after running synchronously', () => {
    const onAbortSpy = spyOn(() => undefined);
    const computation = new Computation(() => ({ value: 123 }), onAbortSpy);

    computation.prime();
    abortIgnoringCleanup(computation);
    expect(computation.result()).to.deep.equal({ value: 123 });
    expect(onAbortSpy.callCount).to.equal(0);
  });

  it('cannot be aborted after erroring synchronously', () => {
    const onAbortSpy = spyOn(() => undefined);
    const computation = new Computation(() => {
      throw new Error('failure');
    }, onAbortSpy);

    computation.prime();
    abortIgnoringCleanup(computation);
    expect(() => computation.result()).to.throw('failure');
    expect(onAbortSpy.callCount).to.equal(0);
  });

  it('can be aborted while running asynchronously', () => {
    const onAbortSpy = spyOn(() => undefined);
    const computation = new Computation(
      () =>
        new Promise(() => {
          // Never resolves.
        }),
      onAbortSpy,
    );

    computation.prime();
    abortIgnoringCleanup(computation);
    expect(onAbortSpy.callCount).to.equal(1);
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
