/**
 *  Copyright (c) 2017, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';

import EventEmitter from 'events';
import eventEmitterAsyncIterator from './eventEmitterAsyncIterator';

describe('eventEmitterAsyncIterator', () => {

  it('subscribe async-iterator mock', async () => {
    // Create an AsyncIterator from an EventEmitter
    const emitter = new EventEmitter();
    const iterator = eventEmitterAsyncIterator(emitter, 'publish');

    // Queue up publishes
    expect(emitter.emit('publish', 'Apple')).to.equal(true);
    expect(emitter.emit('publish', 'Banana')).to.equal(true);

    // Read payloads
    expect(await iterator.next()).to.deep.equal(
      { done: false, value: 'Apple' }
    );
    expect(await iterator.next()).to.deep.equal(
      { done: false, value: 'Banana' }
    );

    // Read ahead
    const i3 = iterator.next().then(x => x);
    const i4 = iterator.next().then(x => x);

    // Publish
    expect(emitter.emit('publish', 'Coconut')).to.equal(true);
    expect(emitter.emit('publish', 'Durian')).to.equal(true);

    // Await out of order to get correct results
    expect(await i4).to.deep.equal({ done: false, value: 'Durian'});
    expect(await i3).to.deep.equal({ done: false, value: 'Coconut'});

    // Read ahead
    const i5 = iterator.next().then(x => x);

    // Terminate emitter
    await iterator.return();

    // Publish is not caught after terminate
    expect(emitter.emit('publish', 'Fig')).to.equal(false);

    // Find that cancelled read-ahead got a "done" result
    expect(await i5).to.deep.equal({ done: true, value: undefined });

    // And next returns empty completion value
    expect(await iterator.next()).to.deep.equal(
      { done: true, value: undefined }
    );
  });
});
