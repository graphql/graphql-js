/**
 * NOTE: the `graphql/subscription` module has been deprecated with its
 * exported functions integrated into the `graphql/execution` module, to
 * better conform with the terminology of the GraphQL specification.
 *
 * For backwards compatibility, the `graphql/subscription` module
 * currently re-exports the moved functions from the `graphql/execution`
 * module. In v17, the `graphql/subscription` module will be dropped entirely.
 *
 * These exports are also available from the root `graphql` package.
 * @packageDocumentation
 * @category Subscriptions
 */

import type { ExecutionArgs } from '../execution/execute';

/**
 * Deprecated legacy alias for ExecutionArgs retained by the subscription
 * module. Use `ExecutionArgs` directly instead because SubscriptionArgs will be
 * removed in v17.
 *
 * ExecutionArgs has been broadened to include all properties within SubscriptionArgs.
 * The SubscriptionArgs type is retained for backwards compatibility.
 * @deprecated use ExecutionArgs instead. Will be removed in v17
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SubscriptionArgs extends ExecutionArgs {}

export { subscribe, createSourceEventStream } from '../execution/subscribe';
