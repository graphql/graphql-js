/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, it } from 'mocha';
import { default as chai, expect } from 'chai';
import { formatWarning } from '../assertValidName';

/* eslint-disable no-console */

/**
 * Helper for dedenting indented template literals. This helps us to
 * keep the tests pretty.
 */
function dedent(string) {
  // Get lines, discarding empty leading and trailing lines.
  const lines = string.replace(/^[ \t]*\n|\n[ \t]*$/g, '').split('\n');

  // Find smallest indent.
  const indent = lines.reduce((currentMinimum, line) => {
    const whitespace = line.match(/^ +/);
    return Math.min(whitespace ? whitespace[0].length : 0, currentMinimum);
  }, Infinity);

  // Remove indent from each line.
  return lines.map(line => line.slice(indent)).join('\n');
}

/**
 * Convenience method for creating an Error object with a defined stack.
 */
function createErrorObject(message, stack) {
  const error = new Error(message);
  error.stack = stack;
  return error;
}

describe('assertValidName()', () => {
  let assertValidName;
  let noNameWarning;
  let warn;

  beforeEach(() => {
    noNameWarning = process.env.GRAPHQL_NO_NAME_WARNING;
    delete process.env.GRAPHQL_NO_NAME_WARNING;
    warn = console.warn;
    console.warn = chai.spy();

    // Make sure module-internal state is reset for each test.
    delete require.cache[require.resolve('../assertValidName')];
    assertValidName = require('../assertValidName').assertValidName;
  });

  afterEach(() => {
    console.warn = warn;
    if (noNameWarning === undefined) {
      delete process.env.GRAPHQL_NO_NAME_WARNING;
    } else {
      process.env.GRAPHQL_NO_NAME_WARNING = noNameWarning;
    }
  });

  it('warns against use of leading double underscores', () => {
    assertValidName('__bad');
    /* eslint-disable no-unused-expressions */
    expect(console.warn).to.have.been.called.once;
    /* eslint-enable no-unused-expressions */
    expect(console.warn.__spy.calls[0][0]).to.match(/must not begin with/);
  });

  it('warns exactly once even in the presence of multiple violations', () => {
    assertValidName('__bad');
    assertValidName('__alsoBad');
    /* eslint-disable no-unused-expressions */
    expect(console.warn).to.have.been.called.once;
    /* eslint-enable no-unused-expressions */
  });

  it('throws for non-strings', () => {
    expect(() => assertValidName({})).to.throw(/Must be named/);
  });

  it('throws for names with invalid characters', () => {
    expect(() => assertValidName('>--()-->')).to.throw(/Names must match/);
  });

  it('does not warn during introspection', () => {
    assertValidName('__bad', true);
    expect(console.warn).not.to.have.been.called();
  });

  it('does not warn when GRAPHQL_NO_NAME_WARNING is in effect', () => {
    process.env.GRAPHQL_NO_NAME_WARNING = '1';
    assertValidName('__bad', true);
    expect(console.warn).not.to.have.been.called();
  });
});

describe('formatWarning()', () => {
  it('formats given a Chrome-style stack property', () => {
    const chromeStack = dedent(`
      Error: foo
        at z (<anonymous>:1:21)
        at y (<anonymous>:1:15)
        at x (<anonymous>:1:15)
        at <anonymous>:1:6
    `);
    const error = createErrorObject('foo', chromeStack);
    expect(formatWarning(error)).to.equal(
      dedent(`
      foo
        at z (<anonymous>:1:21)
        at y (<anonymous>:1:15)
        at x (<anonymous>:1:15)
        at <anonymous>:1:6
    `),
    );
  });

  it('formats given a Node-style stack property', () => {
    const nodeStack = dedent(`
      Error: foo
        at z (repl:1:29)
        at y (repl:1:23)
        at x (repl:1:23)
        at repl:1:6
        at ContextifyScript.Script.runInThisContext (vm.js:23:33)
        at REPLServer.defaultEval (repl.js:340:29)
        at bound (domain.js:280:14)
        at REPLServer.runBound [as eval] (domain.js:293:12)
        at REPLServer.onLine (repl.js:537:10)
        at emitOne (events.js:101:20)
    `);
    const error = createErrorObject('foo', nodeStack);
    expect(formatWarning(error)).to.equal(
      dedent(`
      foo
        at z (repl:1:29)
        at y (repl:1:23)
        at x (repl:1:23)
        at repl:1:6
        at ContextifyScript.Script.runInThisContext (vm.js:23:33)
        at REPLServer.defaultEval (repl.js:340:29)
        at bound (domain.js:280:14)
        at REPLServer.runBound [as eval] (domain.js:293:12)
        at REPLServer.onLine (repl.js:537:10)
        at emitOne (events.js:101:20)
    `),
    );
  });

  it('formats given a Firefox-style stack property', () => {
    const firefoxStack = dedent(`
      z@debugger eval code:1:20
      y@debugger eval code:1:14
      x@debugger eval code:1:14
      @debugger eval code:1:5
    `);
    const error = createErrorObject('foo', firefoxStack);
    expect(formatWarning(error)).to.equal(
      dedent(`
      foo
      z@debugger eval code:1:20
      y@debugger eval code:1:14
      x@debugger eval code:1:14
      @debugger eval code:1:5
    `),
    );
  });

  it('formats given a Safari-style stack property', () => {
    const safariStack = dedent(`
      z
      y
      x
      global code
      evaluateWithScopeExtension@[native code]
      _evaluateOn
      _evaluateAndWrap
      evaluate
    `);
    const error = createErrorObject('foo', safariStack);
    expect(formatWarning(error)).to.equal(
      dedent(`
      foo
      z
      y
      x
      global code
      evaluateWithScopeExtension@[native code]
      _evaluateOn
      _evaluateAndWrap
      evaluate
    `),
    );
  });

  it('formats in the absence of a stack property', () => {
    const error = createErrorObject('foo');
    expect(formatWarning(error)).to.equal('foo');
  });
});
