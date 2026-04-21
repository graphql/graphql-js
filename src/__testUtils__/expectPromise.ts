import { assert, expect } from 'chai';

import { inspect } from '../jsutils/inspect.js';
import { isPromise } from '../jsutils/isPromise.js';

interface PromiseExpectation {
  toResolve: () => Promise<unknown>;
  toRejectWith: (message: string) => Promise<Error>;
}

export function expectPromise(maybePromise: unknown): PromiseExpectation {
  assert(
    isPromise(maybePromise),
    `Expected a promise, received '${inspect(maybePromise)}'`,
  );

  return {
    toResolve(): Promise<unknown> {
      return maybePromise;
    },
    async toRejectWith(message: string): Promise<Error> {
      let caughtError: unknown;
      let resolved;
      let rejected = false;
      try {
        resolved = await maybePromise;
      } catch (error) {
        rejected = true;
        caughtError = error;
      }

      assert(
        rejected,
        `Promise should have rejected with message '${message}', but resolved as '${inspect(
          resolved,
        )}'`,
      );

      expect(caughtError).to.be.an.instanceOf(Error);
      expect(caughtError).to.have.property('message', message);
      return caughtError as Error;
    },
  };
}
