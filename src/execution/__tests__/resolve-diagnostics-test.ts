import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';

import {
  collectEvents,
  sharedFakeDc,
} from '../../__testUtils__/fakeDiagnosticsChannel.js';

import { isPromise } from '../../jsutils/isPromise.js';

import { parse } from '../../language/parser.js';

import { GraphQLObjectType } from '../../type/definition.js';
import { GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { enableDiagnosticsChannel } from '../../diagnostics.js';

import { execute } from '../execute.js';

const schema = buildSchema(`
  type Query {
    sync: String
    async: String
    fail: String
    asyncFail: String
    plain: String
    nested: Nested
  }
  type Nested {
    leaf: String
  }
`);

const rootValue = {
  sync: () => 'hello',
  async: () => Promise.resolve('hello-async'),
  fail: () => {
    throw new Error('boom');
  },
  asyncFail: () => Promise.reject(new Error('async-boom')),
  // no `plain` resolver, default property-access is used.
  plain: 'plain-value',
  nested: { leaf: 'leaf-value' },
};

const resolveChannel = sharedFakeDc.tracingChannel('graphql:resolve');

describe('resolve diagnostics channel', () => {
  let active: ReturnType<typeof collectEvents> | undefined;

  beforeEach(() => {
    enableDiagnosticsChannel(sharedFakeDc);
  });

  afterEach(() => {
    active?.unsubscribe();
    active = undefined;
  });

  it('emits start and end around a synchronous resolver', () => {
    active = collectEvents(resolveChannel);

    const result = execute({ schema, document: parse('{ sync }'), rootValue });
    if (isPromise(result)) {
      throw new Error('expected sync');
    }

    const starts = active.events.filter((e) => e.kind === 'start');
    expect(starts.length).to.equal(1);
    expect(starts[0].ctx.fieldName).to.equal('sync');
    expect(starts[0].ctx.parentType).to.equal('Query');
    expect(starts[0].ctx.fieldType).to.equal('String');
    expect(starts[0].ctx.fieldPath).to.equal('sync');

    const kinds = active.events.map((e) => e.kind);
    expect(kinds).to.deep.equal(['start', 'end']);
  });

  it('emits the full async lifecycle when a resolver returns a promise', async () => {
    active = collectEvents(resolveChannel);

    const result = execute({ schema, document: parse('{ async }'), rootValue });
    await result;

    const kinds = active.events.map((e) => e.kind);
    expect(kinds).to.deep.equal(['start', 'end', 'asyncStart', 'asyncEnd']);
  });

  it('emits start, error, end when a sync resolver throws', () => {
    active = collectEvents(resolveChannel);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    execute({ schema, document: parse('{ fail }'), rootValue });

    const kinds = active.events.map((e) => e.kind);
    expect(kinds).to.deep.equal(['start', 'error', 'end']);
  });

  it('emits full async lifecycle with error when a resolver rejects', async () => {
    active = collectEvents(resolveChannel);

    await execute({
      schema,
      document: parse('{ asyncFail }'),
      rootValue,
    });

    const kinds = active.events.map((e) => e.kind);
    expect(kinds).to.deep.equal([
      'start',
      'end',
      'asyncStart',
      'error',
      'asyncEnd',
    ]);
    const errorEvent = active.events.find((e) => e.kind === 'error');
    expect((errorEvent?.ctx as { error?: Error }).error?.message).to.equal(
      'async-boom',
    );
  });

  it('reports isTrivialResolver based on field.resolve presence', () => {
    const trivialSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          trivial: { type: GraphQLString },
          custom: {
            type: GraphQLString,
            resolve: () => 'explicit',
          },
        },
      }),
    });

    active = collectEvents(resolveChannel);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    execute({
      schema: trivialSchema,
      document: parse('{ trivial custom }'),
      rootValue: { trivial: 'value' },
    });

    const starts = active.events.filter((e) => e.kind === 'start');
    const byField = new Map(
      starts.map((e) => [e.ctx.fieldName, e.ctx.isTrivialResolver]),
    );
    expect(byField.get('trivial')).to.equal(true);
    expect(byField.get('custom')).to.equal(false);
  });

  it('serializes fieldPath lazily, joining path keys with dots', () => {
    active = collectEvents(resolveChannel);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    execute({
      schema,
      document: parse('{ nested { leaf } }'),
      rootValue,
    });

    const starts = active.events.filter((e) => e.kind === 'start');
    const paths = starts.map((e) => e.ctx.fieldPath);
    expect(paths).to.deep.equal(['nested', 'nested.leaf']);
  });

  it('fires once per field, not per schema walk', () => {
    active = collectEvents(resolveChannel);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    execute({
      schema,
      document: parse('{ sync plain nested { leaf } }'),
      rootValue,
    });

    const starts = active.events.filter((e) => e.kind === 'start');
    const endsSync = active.events.filter((e) => e.kind === 'end');
    expect(starts.length).to.equal(4); // sync, plain, nested, nested.leaf
    expect(endsSync.length).to.equal(4);
  });

  it('does nothing when no subscribers are attached', () => {
    const result = execute({
      schema,
      document: parse('{ sync }'),
      rootValue,
    });
    if (isPromise(result)) {
      throw new Error('expected sync');
    }
  });
});
