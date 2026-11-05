import { createRequire } from 'node:module';
import path from 'node:path';

import type {
  BenchContext,
  FirstArgs,
  Scenario,
  WidgetSource,
} from '../shared/fixture.ts';
import { RequestBatchLoader } from '../shared/request-batch-loader.ts';
import type {
  BenchmarkExecutionResult,
  ExecutorRuntime,
} from '../shared/runtime.ts';

interface ExternalGraphQLModule {
  readonly GraphQLID: unknown;
  readonly GraphQLInt: unknown;
  readonly GraphQLList: new (type: unknown) => unknown;
  readonly GraphQLObjectType: new (config: {
    readonly name: string;
    readonly fields:
      | { readonly [fieldName: string]: unknown }
      | (() => { readonly [fieldName: string]: unknown });
  }) => unknown;
  readonly GraphQLSchema: new (config: { readonly query: unknown }) => unknown;
  readonly parse: (source: string) => unknown;
}

interface GraphQLJITModule {
  readonly compileQuery: (
    schema: unknown,
    document: unknown,
  ) =>
    | {
        readonly query: (
          rootValue: unknown,
          contextValue: BenchContext,
          variableValues: { readonly [variableName: string]: unknown },
        ) => BenchmarkExecutionResult | PromiseLike<BenchmarkExecutionResult>;
      }
    | { readonly errors: ReadonlyArray<{ readonly message: string }> };
}

type CompiledQuery = Exclude<
  ReturnType<GraphQLJITModule['compileQuery']>,
  { readonly errors: ReadonlyArray<{ readonly message: string }> }
>;

interface GraphQLJITOptions {
  readonly dataloader?: boolean;
}

export function createGraphQLJITRuntime(
  rootPath: string,
  options: GraphQLJITOptions = {},
): ExecutorRuntime {
  const requireFromRoot = createRequire(path.join(rootPath, 'package.json'));
  const graphQLModule = requireFromRoot('graphql') as ExternalGraphQLModule;
  const graphQLJITModule = requireFromRoot('graphql-jit') as GraphQLJITModule;
  const schema = createSchema(graphQLModule, options);
  const compiledByQuery = new Map<string, CompiledQuery>();

  function getCompiled(scenario: Scenario): CompiledQuery {
    let compiled = compiledByQuery.get(scenario.query);
    if (compiled !== undefined) {
      return compiled;
    }

    const result = graphQLJITModule.compileQuery(
      schema,
      graphQLModule.parse(scenario.query),
    );
    if ('errors' in result) {
      throw new Error(
        `graphql-jit failed to compile query: ${result.errors
          .map((error) => error.message)
          .join('; ')}`,
      );
    }

    compiled = result;
    compiledByQuery.set(scenario.query, compiled);
    return compiled;
  }

  return {
    prepare: (scenario) => {
      getCompiled(scenario);
    },
    execute: (scenario) =>
      getCompiled(scenario).query(scenario.source, createContext(options), {}),
  };
}

function createSchema(
  graphQLModule: ExternalGraphQLModule,
  options: GraphQLJITOptions,
): unknown {
  const {
    GraphQLID,
    GraphQLInt,
    GraphQLList,
    GraphQLObjectType,
    GraphQLSchema,
  } = graphQLModule;

  const WidgetType: unknown = new GraphQLObjectType({
    name: 'Widget',
    fields: () => ({
      id: { type: GraphQLID },
      widget: {
        type: WidgetType,
        resolve: options.dataloader
          ? (source: WidgetSource, _args: unknown, context: BenchContext) =>
              context.loaders?.widget.load(source)
          : async (source: WidgetSource) => {
              await Promise.resolve();
              return source.widget;
            },
      },
      widgets: { type: new GraphQLList(WidgetType) },
    }),
  });

  const QueryType = new GraphQLObjectType({
    name: 'Query',
    fields: {
      widget: { type: WidgetType },
      widgets: {
        type: new GraphQLList(WidgetType),
        args: { first: { type: GraphQLInt } },
        resolve: (source: WidgetSource, args: FirstArgs) => {
          const widgets = source.widgets as ReadonlyArray<unknown>;
          return typeof args.first === 'number'
            ? widgets.slice(0, args.first)
            : widgets;
        },
      },
    },
  });

  return new GraphQLSchema({ query: QueryType });
}

function createContext(options: GraphQLJITOptions): BenchContext {
  if (options.dataloader !== true) {
    return {};
  }

  return {
    loaders: {
      widget: new RequestBatchLoader(async (sources) => {
        await Promise.resolve();
        return sources.map((source) => source.widget);
      }),
    },
  };
}
