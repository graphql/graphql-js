/* eslint-disable n/no-top-level-await */

/*
 * Scenario source: graphql-jit README benchmark "manyResolvers".
 * README: https://github.com/zalando-incubator/graphql-jit/blob/174585f7ae9d9dde17ff80edffaca77d4c145d7f/README.md#benchmarks
 * Code: https://github.com/zalando-incubator/graphql-jit/blob/174585f7ae9d9dde17ff80edffaca77d4c145d7f/src/__benchmarks__/schema-many-resolvers.ts
 * README reference on Node 16.13.0, hardware-dependent:
 * graphql-js 16.x.x 16,415 ops/sec; graphql-jit 178,331 ops/sec.
 */

import {
  blogVariables,
  createGeneratedBenchmark,
  createManyResolversSchema,
  manyResolversDocument,
} from './referenceScenarios.js';

export const benchmark = await createGeneratedBenchmark({
  document: manyResolversDocument,
  importMetaURL: import.meta.url,
  name: 'Generated Reference Many Resolvers',
  schema: createManyResolversSchema(),
  tmpName: 'reference-many-resolvers',
  variableValues: blogVariables,
});
