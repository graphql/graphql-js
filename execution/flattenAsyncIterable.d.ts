declare type AsyncIterableOrGenerator<T> =
  | AsyncGenerator<T, void, void>
  | AsyncIterable<T>;
/**
 * Given an AsyncIterable of AsyncIterables, flatten all yielded results into a
 * single AsyncIterable.
 */
export declare function flattenAsyncIterable<T>(
  iterable: AsyncIterableOrGenerator<AsyncIterableOrGenerator<T>>,
): AsyncGenerator<T, void, void>;
export {};
