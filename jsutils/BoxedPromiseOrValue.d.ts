import type { PromiseOrValue } from './PromiseOrValue.js';
/**
 * A BoxedPromiseOrValue is a container for a value or promise where the value
 * will be updated when the promise resolves.
 *
 * A BoxedPromiseOrValue may only be used with promises whose possible
 * rejection has already been handled, otherwise this will lead to unhandled
 * promise rejections.
 *
 * @internal
 * */
export declare class BoxedPromiseOrValue<T> {
  value: PromiseOrValue<T>;
  constructor(value: PromiseOrValue<T>);
}
