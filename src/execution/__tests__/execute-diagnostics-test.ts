import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';

import {
  collectEvents,
  getTracingChannel,
} from '../../__testUtils__/diagnosticsTestUtils.js';

import { parse } from '../../language/parser.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import type { ExecutionArgs } from '../execute.js';
import {
  execute,
  executeIgnoringIncremental,
  executeSubscriptionEvent,
  executeSync,
  validateExecutionArgs,
} from '../execute.js';

const schema = buildSchema(`
  type Query {
    sync: String
    async: String
  }
`);

const rootValue = {
  sync: () => 'hello',
  async: () => Promise.resolve('hello-async'),
};

const executeChannel = getTracingChannel('graphql:execute');

describe('execute diagnostics channel', () => {
  let active: ReturnType<typeof collectEvents> | undefined;

  afterEach(() => {
    active?.unsubscribe();
    active = undefined;
  });

  it('emits start and end around a synchronous execute', () => {
    active = collectEvents(executeChannel);

    const document = parse('query Q { sync }');
    const result = execute({ schema, document, rootValue });

    expect(result).to.deep.equal({ data: { sync: 'hello' } });
    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
    expect(active.events[0].ctx.operationType).to.equal('query');
    expect(active.events[0].ctx.operationName).to.equal('Q');
    expect(active.events[0].ctx.document).to.equal(document);
    expect(active.events[0].ctx.schema).to.equal(schema);
  });

  it('emits start, end, and async lifecycle when execute returns a promise', async () => {
    active = collectEvents(executeChannel);

    const document = parse('query { async }');
    const result = await execute({ schema, document, rootValue });

    expect(result).to.deep.equal({ data: { async: 'hello-async' } });
    expect(active.events.map((e) => e.kind)).to.deep.equal([
      'start',
      'end',
      'asyncStart',
      'asyncEnd',
    ]);
  });

  it('emits once for executeSync via experimentalExecuteIncrementally', () => {
    active = collectEvents(executeChannel);

    const document = parse('{ sync }');
    executeSync({ schema, document, rootValue });

    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
  });

  it('emits start and end around executeIgnoringIncremental', () => {
    active = collectEvents(executeChannel);

    const document = parse('query Q { sync }');
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    executeIgnoringIncremental({ schema, document, rootValue });

    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
    expect(active.events[0].ctx.operationName).to.equal('Q');
  });

  it('emits start, error, and end when execute throws synchronously', () => {
    active = collectEvents(executeChannel);

    const schemaWithDefer = buildSchema(`
      directive @defer on FIELD
      type Query { sync: String }
    `);
    const document = parse('{ sync }');
    expect(() =>
      execute({ schema: schemaWithDefer, document, rootValue }),
    ).to.throw();

    expect(active.events.map((e) => e.kind)).to.deep.equal([
      'start',
      'error',
      'end',
    ]);
  });

  it('emits for each executeSubscriptionEvent call with resolved operation ctx', () => {
    const args: ExecutionArgs = {
      schema,
      document: parse('query Q { sync }'),
      rootValue,
    };
    const validated = validateExecutionArgs(args);
    if (!('schema' in validated)) {
      throw new Error('unexpected validation failure');
    }

    active = collectEvents(executeChannel);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    executeSubscriptionEvent(validated);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    executeSubscriptionEvent(validated);

    const starts = active.events.filter((e) => e.kind === 'start');
    expect(starts.length).to.equal(2);
    for (const ev of starts) {
      expect(ev.ctx.operationType).to.equal('query');
      expect(ev.ctx.operationName).to.equal('Q');
      expect(ev.ctx.schema).to.equal(schema);
    }
  });

  it('does nothing when no subscribers are attached', () => {
    const document = parse('{ sync }');
    const result = execute({ schema, document, rootValue });
    expect(result).to.deep.equal({ data: { sync: 'hello' } });
  });
});
