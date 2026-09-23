import { createRequire } from 'node:module';
import path from 'node:path';

import type { Scenario, WidgetSource } from '../shared/fixture.ts';
import type {
  BenchmarkExecutionResult,
  ExecutorRuntime,
} from '../shared/runtime.ts';

interface GraphQLBreadthModule {
  readonly Executor: {
    readonly build: (options: {
      readonly schema: unknown;
      readonly document: unknown;
      readonly resolvers: BreadthResolverMap;
      readonly rootObject: unknown;
      readonly validateDocument: false;
    }) => {
      readonly result:
        | BenchmarkExecutionResult
        | PromiseLike<BenchmarkExecutionResult>;
    };
  };
  readonly FieldResolver: new () => object;
  readonly LazyLoader: new (args?: StringKeyedObject) => BreadthLazyLoader;
}

interface BreadthResolverMap {
  readonly [typeName: string]: {
    readonly [fieldName: string]: BreadthFieldResolver;
  };
}

interface BreadthGraphQLModule {
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

interface BreadthFieldResolver {
  readonly resolve: (execField: BreadthExecutionField) => unknown;
}

interface BreadthExecutionField {
  readonly key: string;
  readonly arguments: StringKeyedObject;
  readonly objects: ReadonlyArray<unknown>;
  readonly lazy: (options: {
    readonly loaderClass: BreadthLazyLoaderConstructor;
    readonly keys: ReadonlyArray<unknown>;
    readonly args?: StringKeyedObject;
  }) => unknown;
  readonly mapObjects: <T>(fn: (obj: unknown) => T) => Array<T>;
}

interface BreadthLazyLoader {
  async: boolean;
  map: boolean;
  identityFor?: (key: unknown) => unknown;
  performAsync: (
    keys: ReadonlyArray<unknown>,
  ) => PromiseLike<ReadonlyArray<unknown>>;
}

type BreadthLazyLoaderConstructor = new (
  args?: StringKeyedObject,
) => BreadthLazyLoader;

interface StringKeyedObject {
  readonly [key: string]: unknown;
}

export function createGraphQLBreadthRuntime(rootPath: string): ExecutorRuntime {
  const requireFromBreadth = createRequire(path.join(rootPath, 'package.json'));
  const graphQLBreadthModule = requireFromBreadth(
    path.join(rootPath, 'dist/index.js'),
  ) as GraphQLBreadthModule;
  const graphQLModule = requireFromBreadth('graphql') as BreadthGraphQLModule;

  return buildRuntime(graphQLBreadthModule, graphQLModule);
}

function buildRuntime(
  graphQLBreadthModule: GraphQLBreadthModule,
  graphQLModule: BreadthGraphQLModule,
): ExecutorRuntime {
  const {
    GraphQLID,
    GraphQLInt,
    GraphQLList,
    GraphQLObjectType,
    GraphQLSchema,
  } = graphQLModule;
  const { Executor, FieldResolver, LazyLoader } = graphQLBreadthModule;
  const documentsByQuery = new Map<string, unknown>();

  if (typeof LazyLoader.prototype.performAsync !== 'function') {
    throw new Error(
      'The configured graphql-breadth-js checkout does not support async LazyLoader.performAsync. Use the current main branch or set GRAPHQL_BREADTH_JS_REF to a compatible revision.',
    );
  }

  class FieldKeyResolver extends FieldResolver {
    resolve(execField: BreadthExecutionField): unknown {
      return execField.mapObjects((obj) =>
        obj == null ? null : (obj as StringKeyedObject)[execField.key],
      );
    }
  }

  class ListFieldResolver extends FieldResolver {
    resolve(execField: BreadthExecutionField): unknown {
      const first = execField.arguments.first;
      return execField.mapObjects((obj) => {
        const widgets = (obj as WidgetSource).widgets as ReadonlyArray<unknown>;
        return typeof first === 'number' ? widgets.slice(0, first) : widgets;
      });
    }
  }

  class AsyncFieldKeyResolver extends FieldResolver {
    resolve(execField: BreadthExecutionField): unknown {
      return execField.lazy({
        loaderClass: BreadthBatchLoader,
        args: { key: execField.key },
        keys: [...execField.objects],
      });
    }
  }

  class BreadthBatchLoader extends LazyLoader {
    override async = true;
    override map = true;
    private readonly key: string;

    constructor(args?: StringKeyedObject) {
      super(args);
      this.key = String(args?.key);
    }

    override identityFor = (obj: unknown): unknown => obj;

    override performAsync = async (
      keys: ReadonlyArray<unknown>,
    ): Promise<ReadonlyArray<unknown>> => {
      await Promise.resolve();
      const key = this.key;
      return keys.map((obj) => (obj as StringKeyedObject)[key]);
    };
  }

  const WidgetType: unknown = new GraphQLObjectType({
    name: 'Widget',
    fields: () => ({
      id: { type: GraphQLID },
      widget: { type: WidgetType },
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
      },
    },
  });

  const fieldKey = new FieldKeyResolver() as BreadthFieldResolver;
  const listField = new ListFieldResolver() as BreadthFieldResolver;
  const asyncFieldKey = new AsyncFieldKeyResolver() as BreadthFieldResolver;
  const schema = new GraphQLSchema({ query: QueryType });
  const resolvers = {
    Query: {
      widget: fieldKey,
      widgets: listField,
    },
    Widget: {
      id: fieldKey,
      widget: asyncFieldKey,
      widgets: fieldKey,
    },
  };

  function getDocument(query: string): unknown {
    let document = documentsByQuery.get(query);
    if (document === undefined) {
      document = graphQLModule.parse(query);
      documentsByQuery.set(query, document);
    }

    return document;
  }

  return {
    prepare: (scenario: Scenario) => {
      getDocument(scenario.query);
    },
    execute: (scenario: Scenario) =>
      Executor.build({
        schema,
        document: getDocument(scenario.query),
        resolvers,
        rootObject: scenario.source,
        validateDocument: false,
      }).result,
  };
}
