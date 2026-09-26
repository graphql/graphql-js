/* eslint-disable n/no-top-level-await */

/*
 * Scenario source: graphql-jit README benchmark "nestedArrays".
 * README: https://github.com/zalando-incubator/graphql-jit/blob/174585f7ae9d9dde17ff80edffaca77d4c145d7f/README.md#benchmarks
 * Code: https://github.com/zalando-incubator/graphql-jit/blob/174585f7ae9d9dde17ff80edffaca77d4c145d7f/src/__benchmarks__/schema-nested-array.ts
 * README reference on Node 16.13.0, hardware-dependent:
 * graphql-js 16.x.x 127 ops/sec; graphql-jit 1,316 ops/sec.
 */

import {
  blogVariables,
  createGeneratedBenchmark,
  createNestedArraysSchema,
  nestedArraysDocument,
} from './referenceScenarios.js';

export const benchmark = await createGeneratedBenchmark({
  document: nestedArraysDocument,
  importMetaURL: import.meta.url,
  name: 'Generated Reference Nested Arrays',
  schema: createNestedArraysSchema(),
  tmpName: 'reference-nested-arrays',
  variableValues: blogVariables,
});
