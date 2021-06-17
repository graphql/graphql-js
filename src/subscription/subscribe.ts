import type { Maybe } from '../jsutils/Maybe';

import type { DocumentNode } from '../language/ast';

import { Executor } from '../execution/executor';

import type { ExecutionResult } from '../execution/execute';

import type { GraphQLSchema } from '../type/schema';
import type { GraphQLFieldResolver } from '../type/definition';
import { GraphQLAggregateError } from '../error/GraphQLAggregateError';
import { GraphQLError } from '../error/GraphQLError';

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
  try {
    // TODO:
    // Consider allowing removal of the await keyword below. It is currently
    // necessary because without the explicit await, the function may directly
    // throw, rather than returning a promise that rejects.

    const executor = new Executor(args);
    return await executor.executeSubscription();
  } catch (error) {
    // If it GraphQLError or GraphQLAggregateError, report it as an ExecutionResult,
    // containing only errors and no data.
    // Otherwise, treat the error as a system-class error and re-throw it.

    if (error instanceof GraphQLAggregateError) {
      return Promise.resolve({ errors: error.errors });
    }

    if (error instanceof GraphQLError) {
      return Promise.resolve({ errors: [error] });
    }

    throw error;
  }
}
