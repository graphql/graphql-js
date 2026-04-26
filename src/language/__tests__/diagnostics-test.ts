import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';

import {
  collectEvents,
  expectNoTracingActivity,
  getTracingChannel,
} from '../../__testUtils__/diagnosticsTestUtils.js';

import { parse } from '../parser.js';

const parseChannel = getTracingChannel('graphql:parse');

describe('parse diagnostics channel', () => {
  let active: ReturnType<typeof collectEvents> | undefined;

  afterEach(() => {
    active?.unsubscribe();
    active = undefined;
  });

  it('emits start and end around a successful parse', () => {
    active = collectEvents(parseChannel);

    const doc = parse('{ field }');

    expect(doc.kind).to.equal('Document');
    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
    expect(active.events[0].ctx.source).to.equal('{ field }');
    expect(active.events[1].ctx.source).to.equal('{ field }');
  });

  it('emits start, error, and end when the parser throws', () => {
    active = collectEvents(parseChannel);

    expect(() => parse('{ ')).to.throw();

    const kinds = active.events.map((e) => e.kind);
    expect(kinds).to.deep.equal(['start', 'error', 'end']);
    expect(active.events[1].ctx.error).to.be.instanceOf(Error);
  });

  it('does not call tracing methods when no subscribers are attached', async () => {
    const doc = await expectNoTracingActivity(parseChannel, () =>
      parse('{ field }'),
    );
    expect(doc.kind).to.equal('Document');
  });
});
