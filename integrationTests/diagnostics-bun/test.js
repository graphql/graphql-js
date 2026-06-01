// TracingChannel is marked experimental in Node's docs but is shipped on
// every runtime graphql-js supports. This test exercises it directly.
/* eslint-disable n/no-unsupported-features/node-builtins */

import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import dc from 'node:diagnostics_channel';

import { buildSchema, execute, parse, subscribe, validate } from 'graphql';

function runParseCases() {
  // graphql:parse - synchronous.
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

  // graphql:parse - error path fires start, error, end.
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
}

function runValidateCase() {
  const schema = buildSchema(`type Query { field: String }`);
  const doc = parse('{ field }');

  const events = [];
  const handler = {
    start: (msg) =>
      events.push({
        kind: 'start',
        schema: msg.schema,
        document: msg.document,
      }),
    end: () => events.push({ kind: 'end' }),
    error: (msg) => events.push({ kind: 'error', error: msg.error }),
  };

  const channel = dc.tracingChannel('graphql:validate');
  channel.subscribe(handler);

  try {
    const errors = validate(schema, doc);
    assert.deepEqual(errors, []);
    assert.deepEqual(
      events.map((e) => e.kind),
      ['start', 'end'],
    );
    assert.equal(events[0].schema, schema);
    assert.equal(events[0].document, doc);
  } finally {
    channel.unsubscribe(handler);
  }
}

function runExecuteCase() {
  const schema = buildSchema(`type Query { hello: String }`);
  const document = parse('query Greeting { hello }');

  const events = [];
  const handler = {
    start: (msg) =>
      events.push({
        kind: 'start',
        schema: msg.schema,
        document: msg.document,
        variableValues: msg.variableValues,
        operationName: msg.operationName,
        operationType: msg.operationType,
      }),
    end: () => events.push({ kind: 'end' }),
    asyncStart: () => events.push({ kind: 'asyncStart' }),
    asyncEnd: () => events.push({ kind: 'asyncEnd' }),
    error: (msg) => events.push({ kind: 'error', error: msg.error }),
  };

  const channel = dc.tracingChannel('graphql:execute');
  channel.subscribe(handler);

  try {
    const result = execute({
      schema,
      document,
      rootValue: { hello: 'world' },
    });
    assert.equal(result.data.hello, 'world');
    assert.deepEqual(
      events.map((e) => e.kind),
      ['start', 'end'],
    );
    assert.equal(events[0].operationType, 'query');
    assert.equal(events[0].operationName, 'Greeting');
    assert.equal(events[0].document, document);
    assert.equal(events[0].schema, schema);
  } finally {
    channel.unsubscribe(handler);
  }
}

function runExecuteRootSelectionSetCase() {
  const schema = buildSchema(`type Query { hello: String }`);
  const document = parse('query Greeting { hello }');
  const operation = document.definitions[0];

  const events = [];
  const handler = {
    start: (msg) =>
      events.push({
        kind: 'start',
        schema: msg.schema,
        document: msg.document,
        operation: msg.operation,
        variableValues: msg.variableValues,
        operationName: msg.operationName,
        operationType: msg.operationType,
      }),
    end: (msg) => events.push({ kind: 'end', result: msg.result }),
    asyncStart: () => events.push({ kind: 'asyncStart' }),
    asyncEnd: () => events.push({ kind: 'asyncEnd' }),
    error: (msg) => events.push({ kind: 'error', error: msg.error }),
  };

  const channel = dc.tracingChannel('graphql:execute:rootSelectionSet');
  channel.subscribe(handler);

  try {
    const result = execute({
      schema,
      document,
      rootValue: { hello: 'world' },
    });
    assert.equal(result.data.hello, 'world');
    assert.deepEqual(
      events.map((e) => e.kind),
      ['start', 'end'],
    );
    assert.equal(events[0].operationType, 'query');
    assert.equal(events[0].operationName, 'Greeting');
    assert.equal(events[0].document, document);
    assert.equal(events[0].operation, operation);
    assert.equal(events[0].schema, schema);
    assert.equal(events[1].result, result);
  } finally {
    channel.unsubscribe(handler);
  }
}

async function runSubscribeCase() {
  async function* ticks() {
    yield { tick: 'one' };
  }

  const schema = buildSchema(`
    type Query { dummy: String }
    type Subscription { tick: String }
  `);
  // buildSchema doesn't attach a subscribe resolver to fields; inject one.
  schema.getSubscriptionType().getFields().tick.subscribe = () => ticks();

  const document = parse('subscription Tick { tick }');

  const events = [];
  const handler = {
    start: (msg) =>
      events.push({
        kind: 'start',
        schema: msg.schema,
        document: msg.document,
        variableValues: msg.variableValues,
        operationName: msg.operationName,
        operationType: msg.operationType,
      }),
    end: () => events.push({ kind: 'end' }),
    asyncStart: () => events.push({ kind: 'asyncStart' }),
    asyncEnd: () => events.push({ kind: 'asyncEnd' }),
    error: (msg) => events.push({ kind: 'error', error: msg.error }),
  };

  const channel = dc.tracingChannel('graphql:subscribe');
  channel.subscribe(handler);

  try {
    const result = subscribe({ schema, document });
    const stream = typeof result.then === 'function' ? await result : result;
    if (stream[Symbol.asyncIterator]) {
      await stream.return?.();
    }
    // Subscription setup is synchronous here; start/end fire, no async tail.
    assert.deepEqual(
      events.map((e) => e.kind),
      ['start', 'end'],
    );
    assert.equal(events[0].operationType, 'subscription');
    assert.equal(events[0].operationName, 'Tick');
  } finally {
    channel.unsubscribe(handler);
  }
}

function runResolveCase() {
  const schema = buildSchema(
    `type Query { hello: String nested: Nested } type Nested { leaf: String }`,
  );
  const document = parse('{ hello nested { leaf } }');

  const events = [];
  const handler = {
    start: (msg) =>
      events.push({
        kind: 'start',
        fieldName: msg.fieldName,
        parentType: msg.parentType,
        fieldType: msg.fieldType,
        args: msg.args,
        isDefaultResolver: msg.isDefaultResolver,
        fieldPath: msg.fieldPath,
      }),
    end: () => events.push({ kind: 'end' }),
    asyncStart: () => events.push({ kind: 'asyncStart' }),
    asyncEnd: () => events.push({ kind: 'asyncEnd' }),
    error: (msg) => events.push({ kind: 'error', error: msg.error }),
  };

  const channel = dc.tracingChannel('graphql:resolve');
  channel.subscribe(handler);

  try {
    const rootValue = { hello: () => 'world', nested: { leaf: 'leaf-value' } };
    execute({ schema, document, rootValue });

    const starts = events.filter((e) => e.kind === 'start');
    const paths = starts.map((e) => e.fieldPath);
    assert.deepEqual(paths, ['hello', 'nested', 'nested.leaf']);

    const hello = starts.find((e) => e.fieldName === 'hello');
    assert.equal(hello.parentType, 'Query');
    assert.equal(hello.fieldType, 'String');
    // buildSchema never attaches field.resolve; all fields report as trivial.
    assert.equal(hello.isDefaultResolver, true);
  } finally {
    channel.unsubscribe(handler);
  }
}

function runNoSubscriberCase() {
  const doc = parse('{ field }');
  assert.equal(doc.kind, 'Document');
}

async function runAlsPropagationCase() {
  // A subscriber that binds a store on the `start` sub-channel should be able
  // to read it in every lifecycle handler (start, end, asyncStart, asyncEnd).
  // This is what APMs use to parent child spans to the current operation
  // without threading state through the context object.
  const als = new AsyncLocalStorage();
  const channel = dc.tracingChannel('graphql:execute');
  channel.start.bindStore(als, (context) => ({
    operationName: context.operationName,
  }));

  const seen = {};
  const handler = {
    start: () => (seen.start = als.getStore()),
    end: () => (seen.end = als.getStore()),
    asyncStart: () => (seen.asyncStart = als.getStore()),
    asyncEnd: () => (seen.asyncEnd = als.getStore()),
  };
  channel.subscribe(handler);

  try {
    const schema = buildSchema(`type Query { slow: String }`);
    const document = parse('query Slow { slow }');
    const rootValue = { slow: () => Promise.resolve('done') };

    await execute({ schema, document, rootValue });

    assert.deepEqual(seen.start, { operationName: 'Slow' });
    assert.deepEqual(seen.end, { operationName: 'Slow' });
    assert.deepEqual(seen.asyncStart, { operationName: 'Slow' });
    assert.deepEqual(seen.asyncEnd, { operationName: 'Slow' });
  } finally {
    channel.unsubscribe(handler);
    channel.start.unbindStore(als);
  }
}

async function main() {
  runParseCases();
  runValidateCase();
  runExecuteCase();
  runExecuteRootSelectionSetCase();
  await runSubscribeCase();
  runResolveCase();
  await runAlsPropagationCase();
  runNoSubscriberCase();
  console.log('diagnostics integration test passed');
}

main();
