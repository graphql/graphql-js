/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export default function mapAsyncIterator<T, U>(
  iterable: AsyncIterable<T>,
  callback: (arg: T) => PromiseOrValue<U>,
  rejectCallback?: (arg: any) => PromiseOrValue<U>,
): AsyncGenerator<U, void, void>;
