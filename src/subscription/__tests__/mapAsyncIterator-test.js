/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import mapAsyncIterator from '../mapAsyncIterator';

describe('mapAsyncIterator', () => {

  it('maps over async values', async () => {
    async function* source() {
      yield 1;
      yield 2;
      yield 3;
    }

    const doubles = mapAsyncIterator(source(), x => x + x);

    expect(
      await doubles.next()
    ).to.deep.equal({ value: 2, done: false });
    expect(
      await doubles.next()
    ).to.deep.equal({ value: 4, done: false });
    expect(
      await doubles.next()
    ).to.deep.equal({ value: 6, done: false });
    expect(
      await doubles.next()
    ).to.deep.equal({ value: undefined, done: true });
  });

  it('maps over async values with async function', async () => {
    async function* source() {
      yield 1;
      yield 2;
      yield 3;
    }

    const doubles = mapAsyncIterator(source(), async x => await x + x);

    expect(
      await doubles.next()
    ).to.deep.equal({ value: 2, done: false });
    expect(
      await doubles.next()
    ).to.deep.equal({ value: 4, done: false });
    expect(
      await doubles.next()
    ).to.deep.equal({ value: 6, done: false });
    expect(
      await doubles.next()
    ).to.deep.equal({ value: undefined, done: true });
  });

  it('allows returning early from async values', async () => {
    async function* source() {
      yield 1;
      yield 2;
      yield 3;
    }

    const doubles = mapAsyncIterator(source(), x => x + x);

    expect(
      await doubles.next()
    ).to.deep.equal({ value: 2, done: false });
    expect(
      await doubles.next()
    ).to.deep.equal({ value: 4, done: false });

    // Early return
    expect(
      await doubles.return()
    ).to.deep.equal({ value: undefined, done: true });

    // Subsequent nexts
    expect(
      await doubles.next()
    ).to.deep.equal({ value: undefined, done: true });
    expect(
      await doubles.next()
    ).to.deep.equal({ value: undefined, done: true });
  });

  it('passes through early return from async values', async () => {
    async function* source() {
      try {
        yield 1;
        yield 2;
        yield 3;
      } finally {
        yield 'done';
        yield 'last';
      }
    }

    const doubles = mapAsyncIterator(source(), x => x + x);

    expect(
      await doubles.next()
    ).to.deep.equal({ value: 2, done: false });
    expect(
      await doubles.next()
    ).to.deep.equal({ value: 4, done: false });

    // Early return
    expect(
      await doubles.return()
    ).to.deep.equal({ value: 'donedone', done: false });

    // Subsequent nexts may yield from finally block
    expect(
      await doubles.next()
    ).to.deep.equal({ value: 'lastlast', done: false });
    expect(
      await doubles.next()
    ).to.deep.equal({ value: undefined, done: true });
  });

  it('allows throwing errors through async generators', async () => {
    async function* source() {
      yield 1;
      yield 2;
      yield 3;
    }

    const doubles = mapAsyncIterator(source(), x => x + x);

    expect(
      await doubles.next()
    ).to.deep.equal({ value: 2, done: false });
    expect(
      await doubles.next()
    ).to.deep.equal({ value: 4, done: false });

    // Throw error
    let caughtError;
    try {
      await doubles.throw('ouch');
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).to.equal('ouch');

    expect(
      await doubles.next()
    ).to.deep.equal({ value: undefined, done: true });
    expect(
      await doubles.next()
    ).to.deep.equal({ value: undefined, done: true });
  });

  it('passes through caught errors through async generators', async () => {
    async function* source() {
      try {
        yield 1;
        yield 2;
        yield 3;
      } catch (e) {
        yield e;
      }
    }

    const doubles = mapAsyncIterator(source(), x => x + x);

    expect(
      await doubles.next()
    ).to.deep.equal({ value: 2, done: false });
    expect(
      await doubles.next()
    ).to.deep.equal({ value: 4, done: false });

    // Throw error
    expect(
      await doubles.throw('ouch')
    ).to.deep.equal({ value: 'ouchouch', done: false });

    expect(
      await doubles.next()
    ).to.deep.equal({ value: undefined, done: true });
    expect(
      await doubles.next()
    ).to.deep.equal({ value: undefined, done: true });
  });

});
