import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';

import {
  collectEvents,
  FakeDc,
} from '../../__testUtils__/fakeDiagnosticsChannel.js';

import { enableDiagnosticsChannel } from '../../diagnostics.js';

import { parse } from '../parser.js';

const fakeDc = new FakeDc();
const parseChannel = fakeDc.tracingChannel('graphql:parse');

describe('parse diagnostics channel', () => {
  let active: ReturnType<typeof collectEvents> | undefined;

  beforeEach(() => {
    enableDiagnosticsChannel(fakeDc);
  });

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

  it('does nothing when no subscribers are attached', () => {
    const doc = parse('{ field }');
    expect(doc.kind).to.equal('Document');
  });
});
