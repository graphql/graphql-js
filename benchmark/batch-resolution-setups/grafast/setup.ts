import { createRequire } from 'node:module';
import path from 'node:path';

import { schemaSDL } from '../shared/fixture.ts';
import type {
  BenchmarkExecutionResult,
  ExecutorRuntime,
} from '../shared/runtime.ts';

interface ExternalGraphQLModule {
  readonly parse: (source: string) => unknown;
}

interface GrafastModule {
  readonly access: (source: unknown, path: string) => unknown;
  readonly execute: (args: {
    readonly schema: unknown;
    readonly document: unknown;
    readonly rootValue: unknown;
    readonly contextValue: unknown;
  }) => BenchmarkExecutionResult | PromiseLike<BenchmarkExecutionResult>;
  readonly loadMany: (
    lookup: unknown,
    loader: {
      readonly load: (
        lookups: ReadonlyArray<unknown>,
      ) => PromiseLike<ReadonlyArray<unknown>> | ReadonlyArray<unknown>;
    },
  ) => unknown;
  readonly lambda: (
    spec: ReadonlyArray<unknown>,
    fn: (values: ReadonlyArray<unknown>) => unknown,
    isSyncAndSafe?: boolean,
  ) => unknown;
  readonly makeGrafastSchema: (details: {
    readonly typeDefs: string;
    readonly objects: { readonly [typeName: string]: unknown };
  }) => unknown;
}

interface GrafastFieldArgs {
  readonly $first?: unknown;
}

export function createGrafastRuntime(rootPath: string): ExecutorRuntime {
  process.env.GRAPHILE_ENV ??= 'production';

  const requireFromRoot = createRequire(path.join(rootPath, 'package.json'));
  const graphQLModule = requireFromRoot('graphql') as ExternalGraphQLModule;
  const grafastModule = requireFromRoot('grafast') as GrafastModule;
  const { access, execute, lambda, loadMany, makeGrafastSchema } =
    grafastModule;
  const documentsByQuery = new Map<string, unknown>();

  const schema = makeGrafastSchema({
    typeDefs: schemaSDL,
    objects: {
      Query: {
        plans: {
          widget: ($source: unknown) => access($source, 'widget'),
          widgets: ($source: unknown, args: GrafastFieldArgs) =>
            lambda(
              [access($source, 'widgets'), args.$first],
              ([values, first]) => {
                const widgets = values as ReadonlyArray<unknown>;
                return typeof first === 'number'
                  ? widgets.slice(0, first)
                  : widgets;
              },
              true,
            ),
        },
      },
      Widget: {
        plans: {
          id: ($widget: unknown) => access($widget, 'id'),
          widget: ($widget: unknown) =>
            loadMany(access($widget, 'widget'), {
              load: async (values) => {
                await Promise.resolve();
                return values;
              },
            }),
          widgets: ($widget: unknown) => access($widget, 'widgets'),
        },
      },
    },
  });

  function getDocument(query: string): unknown {
    let document = documentsByQuery.get(query);
    if (document === undefined) {
      document = graphQLModule.parse(query);
      documentsByQuery.set(query, document);
    }

    return document;
  }

  return {
    prepare: (scenario) => {
      getDocument(scenario.query);
    },
    execute: (scenario) =>
      execute({
        schema,
        document: getDocument(scenario.query),
        rootValue: scenario.source,
        contextValue: scenario.source,
      }),
  };
}
