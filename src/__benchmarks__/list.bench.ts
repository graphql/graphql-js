import { bench, describe } from 'vitest';

import { parse } from '../language/parser.js';

import { execute } from '../execution/execute.js';

import { buildSchema } from '../utilities/buildASTSchema.js';

const schema = buildSchema('type Query { listField: [String] }');
const document = parse('{ listField }');

function syncListField() {
  const results = [];
  for (let index = 0; index < 1000; index++) {
    results.push(index);
  }
  return results;
}

// eslint-disable-next-line @typescript-eslint/require-await
async function asyncListField() {
  const results = [];
  for (let index = 0; index < 1000; index++) {
    results.push(Promise.resolve(index));
  }
  return results;
}

// eslint-disable-next-line @typescript-eslint/require-await
async function* asyncIterableListField() {
  for (let index = 0; index < 1000; index++) {
    yield index;
  }
}

describe('execute listField benchmarks', () => {
  bench('Execute Synchronous List Field', async () => {
    await execute({ schema, document, rootValue: { listField: syncListField } });
  });

  bench('Execute Asynchronous List Field', async () => {
    await execute({ schema, document, rootValue: { listField: asyncListField } });
  });

  bench('Execute Async Iterable List Field', async () => {
    await execute({ schema, document, rootValue: { listField: asyncIterableListField } });
  });
});