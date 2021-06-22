import { expect } from 'chai';
import { describe, it } from 'mocha';

import { SimplePubSub } from './simplePubSub';

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

    // Read ahead
    const i3 = iterator.next().then((x) => x);
    const i4 = iterator.next().then((x) => x);

    // Publish
    expect(pubsub.emit('Coconut')).to.equal(true);
    expect(pubsub.emit('Durian')).to.equal(true);

    // Await out of order to get correct results
    expect(await i4).to.deep.equal({ done: false, value: 'Durian' });
    expect(await i3).to.deep.equal({ done: false, value: 'Coconut' });

    // Read ahead
    const i5 = iterator.next().then((x) => x);

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
