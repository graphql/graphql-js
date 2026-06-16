/**
 * TracingChannel integration.
 *
 * GraphQL.js publishes lifecycle events on a set of named tracing channels
 * that application performance monitoring (APM) tools can subscribe to in
 * order to observe parse, validate, execute, subscribe, and resolver behavior,
 * plus selected executor internals. At module load time GraphQL.js resolves
 * `node:diagnostics_channel` itself so APMs do not need to interact with the
 * GraphQL API to enable tracing. On runtimes that do not expose
 * `node:diagnostics_channel` (e.g., browsers) the load silently no-ops and
 * emission sites short-circuit.
 *
 * Within the tracing context types, `error` means the traced JavaScript call
 * threw or rejected; it does not mean every `GraphQLError` returned by
 * GraphQL.js. Some channels complete normally and publish GraphQL errors on
 * `result`. Resolver errors can appear both as `message.error` on
 * `graphql:resolve` and as formatted errors in an enclosing execution or
 * subscription result. `graphql:parse`, `graphql:validate`, and
 * `graphql:execute:variableCoercion` are sync-only channels.
 * @category Diagnostics
 */

import { isPromiseLike } from './jsutils/isPromise.ts';
import type { Maybe } from './jsutils/Maybe.ts';
import type { ObjMap } from './jsutils/ObjMap.ts';

import type { GraphQLError } from './error/GraphQLError.ts';

import type {
  DocumentNode,
  OperationDefinitionNode,
  OperationTypeNode,
} from './language/ast.ts';
import type { Source } from './language/source.ts';

import type { GraphQLSchema } from './type/schema.ts';

import type { ExecutionResult } from './execution/Executor.ts';
import type { ExperimentalIncrementalExecutionResults } from './execution/incremental/IncrementalExecutor.ts';
import type { VariableValues } from './execution/values.ts';

/**
 * Structural subset of `DiagnosticsChannel` sufficient for publishing and
 * subscriber gating. The `node:diagnostics_channel` `Channel` satisfies this.
 *
 * @internal
 */
export interface MinimalChannel<TMessage = unknown> {
  readonly hasSubscribers?: boolean;
  publish: (message: TMessage) => void;
  runStores: <T, ContextType extends object>(
    context: ContextType,
    fn: (this: ContextType, ...args: Array<unknown>) => T,
    thisArg?: unknown,
    ...args: Array<unknown>
  ) => T;
}

/**
 * Structural subset of the Node.js `TracingChannel` API. The
 * `node:diagnostics_channel` `TracingChannel` satisfies this by duck typing,
 * so GraphQL.js does not need a dependency on `@types/node` or on the runtime
 * itself.
 *
 * @internal
 */
export interface MinimalTracingChannel<TContext = unknown> {
  // `undefined` accommodates runtimes (e.g. Bun) that ship `tracingChannel`
  // without exposing the aggregate `hasSubscribers` getter.
  readonly hasSubscribers: boolean | undefined;
  readonly start: MinimalChannel<TContext>;
  readonly end: MinimalChannel<TContext>;
  readonly asyncStart: MinimalChannel<TContext>;
  readonly asyncEnd: MinimalChannel<TContext>;
  readonly error: MinimalChannel<TContext>;

  traceSync: <T>(
    fn: (...args: Array<unknown>) => T,
    context: TContext extends object ? TContext : object,
    thisArg?: unknown,
    ...args: Array<unknown>
  ) => T;
}

interface DiagnosticsChannelModule {
  tracingChannel: <TContext = unknown>(
    name: string,
  ) => MinimalTracingChannel<TContext>;
}

/** Context published on the sync-only `graphql:parse` channel. */
export interface GraphQLParseContext {
  /** Source text or source object passed to the parser. */
  source: string | Source;
  /** Error thrown while parsing, when parsing fails. */
  error?: unknown;
  /** Parsed document, when parsing succeeds. */
  result?: DocumentNode;
}

/** Context published on the sync-only `graphql:validate` channel. */
export interface GraphQLValidateContext {
  /** Schema used for validation. */
  schema: GraphQLSchema;
  /** Parsed document being validated. */
  document: DocumentNode;
  /** Error thrown while validating, when validation fails abruptly. */
  error?: unknown;
  /** Validation errors returned by validation. */
  result?: ReadonlyArray<GraphQLError>;
}

/**
 * Context published on `graphql:execute`.
 *
 * Returned results may contain GraphQL errors collected during execution.
 */
export interface GraphQLExecuteContext {
  /** Schema used for execution. */
  schema: GraphQLSchema;
  /** Parsed document being executed. */
  document: DocumentNode;
  /** Raw variable values provided by the caller before coercion. */
  rawVariableValues: Maybe<{ readonly [variable: string]: unknown }>;
  /** Selected operation name, if one is available. */
  operationName: string | undefined;
  /** Selected operation type, if one is available. */
  operationType: OperationTypeNode | undefined;
  /** Error thrown or rejected while executing, when execution fails abruptly. */
  error?: unknown;
  /** Execution result returned by execution, including GraphQL errors. */
  result?: ExecutionResult | ExperimentalIncrementalExecutionResults;
}

/**
 * Context published on `graphql:execute:rootSelectionSet`.
 *
 * Returned results may contain GraphQL errors collected during execution.
 */
export interface GraphQLExecuteRootSelectionSetContext {
  /** Schema used for execution. */
  schema: GraphQLSchema;
  /** Parsed document being executed. */
  document: DocumentNode;
  /** Operation definition selected for execution. */
  operation: OperationDefinitionNode;
  /** Raw variable values provided by the caller before coercion. */
  rawVariableValues: Maybe<{ readonly [variable: string]: unknown }>;
  /** Selected operation name, if one is available. */
  operationName: string | undefined;
  /** Selected operation type. */
  operationType: OperationTypeNode;
  /** Error thrown or rejected while executing the root selection set. */
  error?: unknown;
  /**
   * Execution result returned from the root selection set, including GraphQL
   * errors.
   */
  result?: ExecutionResult | ExperimentalIncrementalExecutionResults;
}

/**
 * Context published on `graphql:execute:variableCoercion`.
 *
 * Coercion runs synchronously while execution arguments are validated, so only
 * the `start`/`end` (and, on an abrupt throw, `error`) lifecycle fires.
 * Ordinary variable coercion failures are returned on `result.errors`; when
 * execution is invoked through APIs such as `execute()` or `subscribe()`, they
 * surface as GraphQL result errors rather than as the tracing `error`
 * lifecycle event.
 */
export interface GraphQLExecuteVariableCoercionContext {
  /** Schema used for variable coercion. */
  schema: GraphQLSchema;
  /** Parsed document being executed. */
  document: DocumentNode;
  /** Operation definition whose variables are being coerced. */
  operation: OperationDefinitionNode;
  /** Raw variable values provided by the caller before coercion. */
  rawVariableValues: Maybe<{ readonly [variable: string]: unknown }>;
  /** Selected operation name, if one is available. */
  operationName: string | undefined;
  /** Selected operation type. */
  operationType: OperationTypeNode;
  /** Error thrown while coercing variables, when coercion fails abruptly. */
  error?: unknown;
  /** Coerced variable values or coercion errors returned by coercion. */
  result?:
    | { variableValues: VariableValues }
    | { errors: ReadonlyArray<GraphQLError> };
}

/**
 * Context published on `graphql:subscribe`.
 *
 * Subscription source resolver errors and invalid source stream results are
 * returned on `result` as ExecutionResult errors; they do not publish the
 * `error` lifecycle event unless subscription setup fails abruptly before
 * GraphQL can form a result.
 */
export interface GraphQLSubscribeContext {
  /** Schema used for subscription execution. */
  schema: GraphQLSchema;
  /** Parsed subscription document. */
  document: DocumentNode;
  /** Raw variable values provided by the caller before coercion. */
  rawVariableValues: Maybe<{ readonly [variable: string]: unknown }>;
  /** Selected operation name, if one is available. */
  operationName: string | undefined;
  /** Selected operation type, if one is available. */
  operationType: OperationTypeNode | undefined;
  /** Error thrown or rejected while subscribing, when setup fails abruptly. */
  error?: unknown;
  /**
   * Subscription response stream, or an ExecutionResult containing GraphQL
   * errors.
   */
  result?: AsyncGenerator<ExecutionResult, void, void> | ExecutionResult;
}

/**
 * Context published on `graphql:resolve`.
 *
 * Resolver throws and rejections publish the `error` lifecycle event here.
 * The same failure may also be formatted into the enclosing execution or
 * subscription result.
 */
export interface GraphQLResolveContext {
  /** Field name being resolved. */
  fieldName: string;
  /** Response alias for the field being resolved. */
  alias: string;
  /** Parent type name for the field being resolved. */
  parentType: string;
  /** Return type string for the field being resolved. */
  fieldType: string;
  /** Argument values passed to the resolver. */
  args: ObjMap<unknown>;
  /** Whether the field is using the default resolver. */
  isDefaultResolver: boolean;
  /** Response path for the field being resolved. */
  fieldPath: string;
  /** Error thrown or rejected by the resolver, when resolution fails. */
  error?: unknown;
  /** Value returned by the resolver, when resolution succeeds. */
  result?: unknown;
}

/** Mapping from tracing channel name to the context type published on it. */
export interface GraphQLChannelContextByName {
  /** Context published on `graphql:parse`. */
  'graphql:parse': GraphQLParseContext;
  /** Context published on `graphql:validate`. */
  'graphql:validate': GraphQLValidateContext;
  /** Context published on `graphql:execute`. */
  'graphql:execute': GraphQLExecuteContext;
  /** Context published on `graphql:execute:variableCoercion`. */
  'graphql:execute:variableCoercion': GraphQLExecuteVariableCoercionContext;
  /** Context published on `graphql:execute:rootSelectionSet`. */
  'graphql:execute:rootSelectionSet': GraphQLExecuteRootSelectionSetContext;
  /** Context published on `graphql:subscribe`. */
  'graphql:subscribe': GraphQLSubscribeContext;
  /** Context published on `graphql:resolve`. */
  'graphql:resolve': GraphQLResolveContext;
}

/**
 * The collection of tracing channels GraphQL.js emits on. Application
 * performance monitoring (APM) tools subscribe to these by name on their own
 * `node:diagnostics_channel` import; both paths land on the same channel
 * instance because `tracingChannel(name)` is cached by name.
 */
export interface GraphQLChannels {
  /** Tracing channel for `graphql:execute`. */
  execute: MinimalTracingChannel<GraphQLExecuteContext>;
  /** Tracing channel for `graphql:execute:variableCoercion`. */
  executeVariableCoercion: MinimalTracingChannel<GraphQLExecuteVariableCoercionContext>;
  /** Tracing channel for `graphql:execute:rootSelectionSet`. */
  executeRootSelectionSet: MinimalTracingChannel<GraphQLExecuteRootSelectionSetContext>;
  /** Tracing channel for `graphql:parse`. */
  parse: MinimalTracingChannel<GraphQLParseContext>;
  /** Tracing channel for `graphql:validate`. */
  validate: MinimalTracingChannel<GraphQLValidateContext>;
  /** Tracing channel for `graphql:resolve`. */
  resolve: MinimalTracingChannel<GraphQLResolveContext>;
  /** Tracing channel for `graphql:subscribe`. */
  subscribe: MinimalTracingChannel<GraphQLSubscribeContext>;
}

function resolveDiagnosticsChannel(): DiagnosticsChannelModule | undefined {
  let dc: DiagnosticsChannelModule | undefined;
  try {
    const processRef = (
      globalThis as {
        process?: { getBuiltinModule?: (id: string) => unknown };
      }
    ).process;
    if (
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      typeof processRef?.getBuiltinModule === 'function'
    ) {
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      dc = processRef.getBuiltinModule(
        'node:diagnostics_channel',
      ) as DiagnosticsChannelModule;
    }
    /* node:coverage ignore next 3 */
  } catch {
    // diagnostics_channel not available on this runtime; tracing is a no-op.
  }
  return dc;
}

const dc = resolveDiagnosticsChannel();

/**
 * Per-channel handles, resolved once at module load. `undefined` when
 * `node:diagnostics_channel` isn't available. Emission sites read these
 * directly to keep the no-subscriber fast path to a single property access
 * plus a `hasSubscribers` check (no function calls, no closures).
 *
 * @internal
 */
export const parseChannel:
  | MinimalTracingChannel<GraphQLParseContext>
  | undefined = dc?.tracingChannel('graphql:parse');
/** @internal */
export const validateChannel:
  | MinimalTracingChannel<GraphQLValidateContext>
  | undefined = dc?.tracingChannel('graphql:validate');
/** @internal */
export const executeChannel:
  | MinimalTracingChannel<GraphQLExecuteContext>
  | undefined = dc?.tracingChannel('graphql:execute');
/** @internal */
export const executeVariableCoercionChannel:
  | MinimalTracingChannel<GraphQLExecuteVariableCoercionContext>
  | undefined = dc?.tracingChannel('graphql:execute:variableCoercion');
/** @internal */
export const executeRootSelectionSetChannel:
  | MinimalTracingChannel<GraphQLExecuteRootSelectionSetContext>
  | undefined = dc?.tracingChannel('graphql:execute:rootSelectionSet');
/** @internal */
export const subscribeChannel:
  | MinimalTracingChannel<GraphQLSubscribeContext>
  | undefined = dc?.tracingChannel('graphql:subscribe');
/** @internal */
export const resolveChannel:
  | MinimalTracingChannel<GraphQLResolveContext>
  | undefined = dc?.tracingChannel('graphql:resolve');

const SUB_CHANNEL_KEYS: ReadonlyArray<
  'start' | 'end' | 'asyncStart' | 'asyncEnd' | 'error'
> = ['start', 'end', 'asyncStart', 'asyncEnd', 'error'];

/**
 * Whether emission sites should publish to `channel`. Trusts the
 * `TracingChannel.hasSubscribers` aggregate when the runtime exposes it; if
 * the getter is missing (e.g. Bun's `node:diagnostics_channel`, where
 * `tracingChannel.hasSubscribers` is `undefined`), falls back to checking
 * each of the five underlying lifecycle channels so a subscriber attached
 * via `tracingChannel.subscribe(handlers)` is still observed.
 *
 * @internal
 */
export function shouldTrace<TContext = unknown>(
  channel: MinimalTracingChannel<TContext> | undefined,
): channel is MinimalTracingChannel<TContext> {
  if (channel == null) {
    return false;
  }
  const aggregate = channel.hasSubscribers;
  if (aggregate !== undefined) {
    return aggregate;
  }
  // Bun-only fallback, exercised by integrationTests/diagnostics-bun.
  for (const key of SUB_CHANNEL_KEYS) {
    if (channel[key].hasSubscribers) {
      return true;
    }
  }
  return false;
}

interface TraceLifecycleContext {
  error?: unknown;
  result?: unknown;
}

type TraceStartContext<TContext extends TraceLifecycleContext> = Omit<
  TContext,
  'error' | 'result'
>;

/**
 * Publish a traced call that may complete synchronously or with a promise.
 * Caller has already verified that a subscriber is attached. On normal
 * completion, `result` is attached before the terminal `end` or `asyncEnd`
 * event. When the traced call throws or rejects, `error` is attached, the
 * `error` sub-channel fires, and the terminal `end` or `asyncEnd` event is
 * published before the original failure is propagated.
 *
 * @internal
 */
export function traceMixed<TResult, TContext extends TraceLifecycleContext>(
  channel: MinimalTracingChannel<TContext>,
  contextInput: TraceStartContext<TContext>,
  fn: () => TResult,
): TResult {
  const context = contextInput as TContext;

  return channel.start.runStores(context, () => {
    let result: TResult;
    try {
      result = fn();
    } catch (err) {
      context.error = err;
      channel.error.publish(context);
      channel.end.publish(context);
      throw err;
    }

    if (!isPromiseLike(result)) {
      context.result = result;
      channel.end.publish(context);
      return result;
    }

    channel.end.publish(context);

    return result.then(
      (value) => {
        context.result = value;
        channel.asyncStart.publish(context);
        channel.asyncEnd.publish(context);
        return value;
      },
      (err: unknown) => {
        context.error = err;
        channel.error.publish(context);
        channel.asyncStart.publish(context);
        channel.asyncEnd.publish(context);
        throw err;
      },
    ) as TResult;
  });
}
