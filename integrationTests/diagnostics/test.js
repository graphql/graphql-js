// TracingChannel is marked experimental in Node's docs but is shipped on
// every runtime graphql-js supports. This test exercises it directly.
/* eslint-disable n/no-unsupported-features/node-builtins */

import assert from 'node:assert/strict';
import dc from 'node:diagnostics_channel';

import { enableDiagnosticsChannel, parse } from 'graphql';

enableDiagnosticsChannel(dc);

// graphql:parse - synchronous
{
  const events = [];
  const handler = {
    start: (msg) => events.push({ kind: 'start', source: msg.source }),
    end: (msg) => events.push({ kind: 'end', source: msg.source }),
    asyncStart: (msg) =>
      events.push({ kind: 'asyncStart', source: msg.source }),
    asyncEnd: (msg) => events.push({ kind: 'asyncEnd', source: msg.source }),
    error: (msg) =>
      events.push({ kind: 'error', source: msg.source, error: msg.error }),
  };

  const channel = dc.tracingChannel('graphql:parse');
  channel.subscribe(handler);

  try {
    const doc = parse('{ field }');
    assert.equal(doc.kind, 'Document');
    assert.deepEqual(
      events.map((e) => e.kind),
      ['start', 'end'],
    );
    assert.equal(events[0].source, '{ field }');
    assert.equal(events[1].source, '{ field }');
  } finally {
    channel.unsubscribe(handler);
  }
}

// graphql:parse - error path fires start, error, end (traceSync finally-emits end)
{
  const events = [];
  const handler = {
    start: (msg) => events.push({ kind: 'start', source: msg.source }),
    end: (msg) => events.push({ kind: 'end', source: msg.source }),
    error: (msg) =>
      events.push({ kind: 'error', source: msg.source, error: msg.error }),
  };

  const channel = dc.tracingChannel('graphql:parse');
  channel.subscribe(handler);

  try {
    assert.throws(() => parse('{ '));
    assert.deepEqual(
      events.map((e) => e.kind),
      ['start', 'error', 'end'],
    );
    assert.ok(events[1].error instanceof Error);
  } finally {
    channel.unsubscribe(handler);
  }
}

// No-op when nothing is subscribed - parse still succeeds.
{
  const doc = parse('{ field }');
  assert.equal(doc.kind, 'Document');
}

console.log('diagnostics integration test passed');
