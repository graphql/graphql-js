/**
 * Returns true if the provided object implements the AsyncIterator protocol via
 * implementing a `Symbol.asyncIterator` method.
 */
export function isAsyncIterable(
  maybeAsyncIterable: unknown,
): maybeAsyncIterable is AsyncIterable<unknown>;
