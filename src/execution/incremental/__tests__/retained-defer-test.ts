import { describe, it } from 'node:test';
import { setImmediate } from 'node:timers/promises';

import { assert, expect } from 'chai';

import { promiseWithResolvers } from '../../../jsutils/promiseWithResolvers.ts';

import { parse } from '../../../language/parser.ts';

import { validate } from '../../../validation/validate.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import { experimentalExecuteIncrementally } from '../../execute.ts';

import type { SubsequentIncrementalExecutionResult } from '../IncrementalExecutor.ts';

const schema = buildSchema(`
  directive @defer(if: Boolean! = true, label: String)
    on FRAGMENT_SPREAD | INLINE_FRAGMENT
  directive @stream(if: Boolean! = true, label: String, initialCount: Int! = 0)
    on FIELD
  type Query { bad: String!, x: String, slow: String, xs: [String], user: User }
  type User { bad: String! }
`);

async function run(
  query: string,
  stages: ReadonlyArray<{ [key: string]: unknown }>,
  enableEarlyExecution = false,
) {
  const document = parse(query);
  expect(validate(schema, document)).to.deep.equal([]);
  const gates = new Map(
    stages.flatMap((stage) =>
      Object.keys(stage).map(
        (key) => [key, promiseWithResolvers<unknown>()] as const,
      ),
    ),
  );
  const requested = new Set<string>();
  const result = await experimentalExecuteIncrementally({
    schema,
    document,
    enableEarlyExecution,
    fieldResolver(_source, _args, _context, info) {
      const key = String(info.path.key);
      requested.add(key);
      return gates.get(key)?.promise;
    },
  });
  assert('initialResult' in result);
  const updates: Array<SubsequentIncrementalExecutionResult> = [];
  const consumed = (async () => {
    for await (const update of result.subsequentResults) {
      updates.push(update);
    }
  })();
  await setImmediate();
  for (const stage of stages) {
    for (const [key, value] of Object.entries(stage)) {
      expect(requested.has(key), `${key} has started`).to.equal(true);
      gates.get(key)?.resolve(value);
    }
    // Let this settlement reach the queue before releasing the next one.
    // eslint-disable-next-line no-await-in-loop
    await setImmediate();
  }
  await consumed;
  const announced = new Set(
    result.initialResult.pending.map((entry) => entry.id),
  );
  const open = new Set(announced);
  for (const update of updates) {
    for (const entry of update.pending ?? []) {
      expect(announced.has(entry.id)).to.equal(false);
      announced.add(entry.id);
      open.add(entry.id);
    }
    for (const patch of update.incremental ?? []) {
      expect(open.has(patch.id)).to.equal(true);
    }
    for (const entry of update.completed ?? []) {
      expect(open.delete(entry.id)).to.equal(true);
    }
  }
  expect(open.size).to.equal(0);
  const pending = [
    ...result.initialResult.pending,
    ...updates.flatMap((update) => update.pending ?? []),
  ];
  const labels = new Map(pending.map((entry) => [entry.id, entry.label]));
  return {
    labels: pending.map((entry) => entry.label),
    data: updates
      .flatMap((update) => update.incremental ?? [])
      .flatMap((patch) => ('data' in patch ? [patch.data] : [])),
    items: updates
      .flatMap((update) => update.incremental ?? [])
      .flatMap((patch) => ('items' in patch ? patch.items : [])),
    completed: updates
      .flatMap((update) => update.completed ?? [])
      .map((entry) => ({
        label: labels.get(entry.id),
        errors: entry.errors?.map((error) => error.path),
      })),
    hasNext: updates.at(-1)?.hasNext,
  };
}

describe('Execute: outcomes settled before defer release', () => {
  const query = `{
    ... @defer(label: "R") { bad x }
    ... @defer(label: "P") { slow ... @defer(label: "C") { x } }
  }`;

  for (const early of [false, true]) {
    it(`delivers a buffered shared value after release (early=${early})`, async () => {
      const result = await run(
        query,
        [{ bad: null }, { x: 'X' }, { slow: 'ok' }],
        early,
      );
      expect(result.labels).to.deep.equal(['R', 'P', 'C']);
      expect(result.data).to.deep.equal([{ slow: 'ok' }, { x: 'X' }]);
      expect(result.hasNext).to.equal(false);
    });

    it(`delivers the same value when the parent settles first (early=${early})`, async () => {
      const result = await run(
        query,
        [{ bad: null }, { slow: 'ok' }, { x: 'X' }],
        early,
      );
      expect(result.labels).to.deep.equal(['R', 'P', 'C']);
      expect(result.data).to.deep.equal([{ slow: 'ok' }, { x: 'X' }]);
      expect(result.hasNext).to.equal(false);
    });
  }

  it('retains a failure after the shared task loses its announced owner', async () => {
    const result = await run(
      `{
      ... @defer(label: "R") { first: bad bad }
      ... @defer(label: "P") { slow ... @defer(label: "C") { bad } }
    }`,
      [{ first: null }, { bad: null }, { slow: 'ok' }],
    );
    expect(result.labels).to.deep.equal(['R', 'P', 'C']);
    expect(result.completed).to.deep.equal([
      { label: 'R', errors: [['first']] },
      { label: 'P', errors: undefined },
      { label: 'C', errors: [['bad']] },
    ]);
    expect(result.hasNext).to.equal(false);
  });

  for (const wrapper of [false, true]) {
    it(`cancels children registered after their parent fails (wrapper=${wrapper})`, async () => {
      const child = '... @defer(label: "C") { x: bad }';
      const result = await run(
        `{
        ... @defer(label: "P") {
          pBad: bad
          user { ${wrapper ? `... @defer(label: "E") { ${child} }` : child} }
        }
        ... @defer(label: "Q") {
          keepQ: slow user { ... @defer(label: "D") { x: bad y: bad } }
        }
        ... @defer(label: "R") { rBad: bad user { x: bad } }
        ... @defer(label: "S") { user { y: bad } }
      }`,
        [
          { pBad: null },
          { user: {} },
          { y: null },
          { rBad: null },
          { x: null },
          { keepQ: 'ok' },
        ],
      );
      expect(result.labels).to.deep.equal(['P', 'Q', 'R', 'S', 'D']);
      expect(result.completed).to.deep.equal([
        { label: 'P', errors: [['pBad']] },
        { label: 'S', errors: [['user', 'y']] },
        { label: 'R', errors: [['rBad']] },
        { label: 'Q', errors: undefined },
        { label: 'D', errors: [['user', 'y']] },
      ]);
      expect(result.hasNext).to.equal(false);
    });
  }
});
