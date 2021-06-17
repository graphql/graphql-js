import { inspect } from '../jsutils/inspect';
import { isAsyncIterable } from '../jsutils/isAsyncIterable';
import { addPath, pathToArray } from '../jsutils/Path';
import type { Maybe } from '../jsutils/Maybe';

import { GraphQLError } from '../error/GraphQLError';
import { locatedError } from '../error/locatedError';

import type { DocumentNode } from '../language/ast';

import type { ExecutionContext, ExecutionResult } from '../execution/execute';
import { collectFields } from '../execution/collectFields';
import { getArgumentValues } from '../execution/values';
import { Executor, getFieldDef } from '../execution/executor';
import { buildExecutionContext, execute } from '../execution/execute';

import type { GraphQLSchema } from '../type/schema';
import type { GraphQLFieldResolver } from '../type/definition';

import { getOperationRootType } from '../utilities/getOperationRootType';

import { mapAsyncIterator } from './mapAsyncIterator';

export interface SubscriptionArgs {
  schema: GraphQLSchema;
  document: DocumentNode;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<{ readonly [variable: string]: unknown }>;
  operationName?: Maybe<string>;
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
}

/**
 * Implements the "Subscribe" algorithm described in the GraphQL specification.
 *
 * Returns a Promise which resolves to either an AsyncIterator (if successful)
 * or an ExecutionResult (error). The promise will be rejected if the schema or
 * other arguments to this function are invalid, or if the resolved event stream
 * is not an async iterable.
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, a GraphQL Response (ExecutionResult) with
 * descriptive errors and no data will be returned.
 *
 * If the source stream could not be created due to faulty subscription
 * resolver logic or underlying systems, the promise will resolve to a single
 * ExecutionResult containing `errors` and no `data`.
 *
 * If the operation succeeded, the promise resolves to an AsyncIterator, which
 * yields a stream of ExecutionResults representing the response stream.
 *
 * Accepts either an object with named arguments, or individual arguments.
 */
export async function subscribe(
  args: SubscriptionArgs,
): Promise<AsyncGenerator<ExecutionResult, void, void> | ExecutionResult> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext({
    ...args,
    fieldResolver: args.subscribeFieldResolver,
  });

  // Return early errors if execution context failed.
  if (!('schema' in exeContext)) {
    return { errors: exeContext };
  }

  const executor = new SubscriptionExecutor(exeContext, args.document);
  return executor.executeSubscription();
}

/**
 * This class is exported only to assist people in implementing their own executors
 * without duplicating too much code and should be used only as last resort for cases
 * requiring custom execution or if certain features could not be contributed upstream.
 *
 * It is still part of the internal API and is versioned, so any changes to it are never
 * considered breaking changes. If you still need to support multiple versions of the
 * library, please use the `versionInfo` variable for version detection.
 *
 * @internal
 */
export class SubscriptionExecutor extends Executor {
  protected _document: DocumentNode;

  constructor(exeContext: ExecutionContext, document: DocumentNode) {
    super(exeContext);
    this._document = document;
  }

  async executeSubscription(): Promise<AsyncGenerator<ExecutionResult, void, void> | ExecutionResult> {
    const resultOrStream = await this.createSourceEventStream();

    if (!isAsyncIterable(resultOrStream)) {
      return resultOrStream;
    }
  
    // For each payload yielded from a subscription, map it over the normal
    // GraphQL `execute` function, with `payload` as the rootValue.
    // This implements the "MapSourceToResponseEvent" algorithm described in
    // the GraphQL specification. The `execute` function provides the
    // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
    // "ExecuteQuery" algorithm, for which `execute` is also used.
    const mapSourceToResponse = (payload: unknown) =>
      execute({
        schema: this._schema,
        document: this._document,
        rootValue: payload,
        contextValue: this._contextValue,
        variableValues: this._variableValues,
        fieldResolver: this._fieldResolver,
      });
  
    // Map every source value to a ExecutionResult value as described above.
    return mapAsyncIterator(resultOrStream, mapSourceToResponse);  
  }

  /**
   * Implements the "CreateSourceEventStream" algorithm described in the
   * GraphQL specification, resolving the subscription source event stream.
   *
   * Returns a Promise which resolves to either an AsyncIterable (if successful)
   * or an ExecutionResult (error). The promise will be rejected if the schema or
   * other arguments to this function are invalid, or if the resolved event stream
   * is not an async iterable.
   *
   * If the client-provided arguments to this function do not result in a
   * compliant subscription, a GraphQL Response (ExecutionResult) with
   * descriptive errors and no data will be returned.
   *
   * If the the source stream could not be created due to faulty subscription
   * resolver logic or underlying systems, the promise will resolve to a single
   * ExecutionResult containing `errors` and no `data`.
   *
   * If the operation succeeded, the promise resolves to the AsyncIterable for the
   * event stream returned by the resolver.
   *
   * A Source Event Stream represents a sequence of events, each of which triggers
   * a GraphQL execution for that event.
   *
   * This may be useful when hosting the stateful subscription service in a
   * different process or machine than the stateless GraphQL execution engine,
   * or otherwise separating these two steps. For more on this, see the
   * "Supporting Subscriptions at Scale" information in the GraphQL specification.
   */
  async createSourceEventStream(): Promise<AsyncIterable<unknown> | ExecutionResult> {
    try {
      const eventStream = await this._createSourceEventStream();
  
      // Assert field returned an event stream, otherwise yield an error.
      if (!isAsyncIterable(eventStream)) {
        throw new Error(
          'Subscription field must return Async Iterable. ' +
            `Received: ${inspect(eventStream)}.`,
        );
      }
  
      return eventStream;
    } catch (error) {
      // If it GraphQLError, report it as an ExecutionResult, containing only errors and no data.
      // Otherwise treat the error as a system-class error and re-throw it.
      if (error instanceof GraphQLError) {
        return { errors: [error] };
      }
      throw error;
    }  
  }

  public async _createSourceEventStream(): Promise<unknown> {
    const {
      _schema,
      _fragments,
      _rootValue,
      _contextValue,
      _operation,
      _variableValues,
      _fieldResolver,
    } = this;
    const type = getOperationRootType(_schema, _operation);
    const fields = collectFields(
      _schema,
      _fragments,
      _variableValues,
      type,
      _operation.selectionSet,
      new Map(),
      new Set(),
    );
    const [responseName, fieldNodes] = [...fields.entries()][0];
    const fieldDef = getFieldDef(_schema, type, fieldNodes[0]);

    if (!fieldDef) {
      const fieldName = fieldNodes[0].name.value;
      throw new GraphQLError(
        `The subscription field "${fieldName}" is not defined.`,
        fieldNodes,
      );
    }

    const path = addPath(undefined, responseName, type.name);
    const info = this.buildResolveInfo(fieldDef, fieldNodes, type, path);

    try {
      // Implements the "ResolveFieldEventStream" algorithm from GraphQL specification.
      // It differs from "ResolveFieldValue" due to providing a different `resolveFn`.

      // Build a JS object of arguments from the field.arguments AST, using the
      // variables scope to fulfill any variable references.
      const args = getArgumentValues(fieldDef, fieldNodes[0], _variableValues);

      // Call the `subscribe()` resolver or the default resolver to produce an
      // AsyncIterable yielding raw payloads.
      const resolveFn = fieldDef.subscribe ?? _fieldResolver;

      // The resolve function's optional third argument is a context value that
      // is provided to every resolve function within an execution. It is commonly
      // used to represent an authenticated user, or request-specific caches.
      const eventStream = await resolveFn(
        _rootValue,
        args,
        _contextValue,
        info,
      );

      if (eventStream instanceof Error) {
        throw eventStream;
      }
      return eventStream;
    } catch (error) {
      throw locatedError(error, fieldNodes, pathToArray(path));
    }
  }
}
