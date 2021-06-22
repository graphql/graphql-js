import type { Maybe } from '../jsutils/Maybe';

import type { DocumentNode } from '../language/ast';

import { isAggregateOfGraphQLErrors } from '../error/GraphQLAggregateError';

import type { GraphQLSchema } from '../type/schema';
import type {
  GraphQLFieldResolver,
  GraphQLTypeResolver,
} from '../type/definition';

import { Executor } from './executor';
import type { ExecutionResult } from './execute';

export interface SubscriptionArgs {
  schema: GraphQLSchema;
  document: DocumentNode;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<{ readonly [variable: string]: unknown }>;
  operationName?: Maybe<string>;
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  typeResolver?: Maybe<GraphQLTypeResolver<any, any>>;
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
  let executor: Executor;
  try {
    executor = new Executor(args);
  } catch (error) {
    // Note: if the Executor constructor throws a GraphQLAggregateError, it will be
    // of type GraphQLAggregateError<GraphQLError>, but this is checked explicitly.
    if (isAggregateOfGraphQLErrors(error)) {
      return { errors: error.errors };
    }
    throw error;
  }

  return executor.executeSubscription();
}
