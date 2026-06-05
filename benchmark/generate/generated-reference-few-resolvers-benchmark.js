/* eslint-disable n/no-top-level-await */

/*
 * Scenario source: graphql-jit README benchmark "fewResolvers".
 * README: https://github.com/zalando-incubator/graphql-jit/blob/174585f7ae9d9dde17ff80edffaca77d4c145d7f/README.md#benchmarks
 * Code: https://github.com/zalando-incubator/graphql-jit/blob/174585f7ae9d9dde17ff80edffaca77d4c145d7f/src/__benchmarks__/schema-few-resolvers.ts
 * README reference on Node 16.13.0, hardware-dependent:
 * graphql-js 16.x.x 26,620 ops/sec; graphql-jit 339,223 ops/sec.
 */

import {
  blogVariables,
  createFewResolversSchema,
  createGeneratedBenchmark,
  fewResolversDocument,
} from './referenceScenarios.js';

export const benchmark = await createGeneratedBenchmark({
  document: fewResolversDocument,
  importMetaURL: import.meta.url,
  name: 'Generated Reference Few Resolvers',
  schema: createFewResolversSchema(),
  tmpName: 'reference-few-resolvers',
  variableValues: blogVariables,
});
