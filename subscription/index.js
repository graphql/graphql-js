/**
 * NOTE: the `graphql/subscription` module has been deprecated with its
 * exported functions integrated into the `graphql/execution` module, to
 * better conform with the terminology of the GraphQL specification.
 *
 * For backwards compatibility, the `graphql/subscription` module
 * currently re-exports the moved functions from the `graphql/execution`
 * module. In the next major release, the `graphql/subscription` module
 * will be dropped entirely.
 */
export { subscribe, createSourceEventStream } from '../execution/subscribe.js';
