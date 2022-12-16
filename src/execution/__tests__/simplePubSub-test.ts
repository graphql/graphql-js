import { expect } from 'chai';
import { describe, it } from 'mocha';

import { SimplePubSub } from './simplePubSub.js';

describe('SimplePubSub', () => {
  it('subscribe async-iterator mock', async () => {
    const pubsub = new SimplePubSub();
    const iterator = pubsub.getSubscriber((x) => x);

    // Queue up publishes
    expect(pubsub.emit('Apple')).to.equal(true);
    expect(pubsub.emit('Banana')).to.equal(true);

    // Read payloads
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 'Apple',
    });
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 'Banana',
    });

    async function getNextItem(i: AsyncIterator<unknown>) {
      return await i.next();
    }

    // Read ahead
    const i3 = getNextItem(iterator);
    const i4 = getNextItem(iterator);

    // Publish
    expect(pubsub.emit('Coconut')).to.equal(true);
    expect(pubsub.emit('Durian')).to.equal(true);

    // Await out of order to get correct results
    expect(await i4).to.deep.equal({ done: false, value: 'Durian' });
    expect(await i3).to.deep.equal({ done: false, value: 'Coconut' });

    // Read ahead
    const i5 = getNextItem(iterator);

    // Terminate queue
    await iterator.return();

    // Publish is not caught after terminate
    expect(pubsub.emit('Fig')).to.equal(false);

    // Find that cancelled read-ahead got a "done" result
    expect(await i5).to.deep.equal({ done: true, value: undefined });

    // And next returns empty completion value
    expect(await iterator.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
  });
});
