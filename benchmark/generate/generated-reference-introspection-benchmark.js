/* eslint-disable n/no-top-level-await */

/*
 * Scenario source: graphql-jit README benchmark "introspection".
 * README: https://github.com/zalando-incubator/graphql-jit/blob/174585f7ae9d9dde17ff80edffaca77d4c145d7f/README.md#benchmarks
 * Code: https://github.com/zalando-incubator/graphql-jit/blob/174585f7ae9d9dde17ff80edffaca77d4c145d7f/src/__benchmarks__/benchmarks.ts
 * README reference on Node 16.13.0, hardware-dependent:
 * graphql-js 16.x.x 1,941 ops/sec; graphql-jit 6,158 ops/sec.
 */

import { parse } from 'graphql/language/parser.js';
import { getIntrospectionQuery } from 'graphql/utilities/getIntrospectionQuery.js';

import {
  createGeneratedBenchmark,
  createNestedArraysSchema,
} from './referenceScenarios.js';

export const benchmark = await createGeneratedBenchmark({
  document: parse(getIntrospectionQuery({ descriptions: true })),
  importMetaURL: import.meta.url,
  name: 'Generated Reference Introspection',
  schema: createNestedArraysSchema(),
  tmpName: 'reference-introspection',
  variableValues: {},
});
