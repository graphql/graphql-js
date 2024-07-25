/* eslint-disable no-console */
import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';

import { checkForMultiplePackageInstances } from '../checkForMultiplePackageInstances.js';

describe('check for different library versions', () => {
  class OtherPackageClass {}
  const graphqlPackageInstanceCheckSymbol = Symbol.for(
    'graphql-js:check-multiple-package-instances',
  );
  const globalObject = globalThis as {
    [graphqlPackageInstanceCheckSymbol]?: unknown;
  };
  const orig = globalObject[graphqlPackageInstanceCheckSymbol];
  const origError = console.error;
  let errors: Array<unknown> = [];
  beforeEach(() => {
    errors = [];
    console.error = (...args) => {
      errors = args;
    };
  });

  afterEach(() => {
    globalObject[graphqlPackageInstanceCheckSymbol] = orig;
    console.error = origError;
  });

  it('does not log an error under normal circumstances', () => {
    checkForMultiplePackageInstances();
    expect(errors).to.deep.equal([]);
    checkForMultiplePackageInstances();
    expect(errors).to.deep.equal([]);
    checkForMultiplePackageInstances();
    expect(errors).to.deep.equal([]);
  });

  it('logs an error if another package has been loaded first', () => {
    // simulate other version of this lib to have been loaded before this version
    globalObject[graphqlPackageInstanceCheckSymbol] = new OtherPackageClass();

    checkForMultiplePackageInstances();

    expect(errors[0]).to.match(
      /Multiple colliding versions of the `graphql` package detected\./m,
    );
  });
});
