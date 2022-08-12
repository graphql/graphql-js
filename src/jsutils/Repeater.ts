/**
 * Implementation from: https://github.com/repeaterjs/repeater/blob/219a0c8faf2c2768d234ecfe8dd21d455a4a98fe/packages/repeater/src/repeater.ts
 * Original Author: Brian Kim
 * License: MIT
 *
 * Changes to return() method:
 * - Calls to return() should occur sequentially with calls to next just like throw.
 * - Calls to return() must be recoverable to mimic finally block in generators.
 * - Therefore: return() now simply throws an object of RepeaterClosureSignal class into the Repeater to allow handling of early returns.
 * - Unlike throw(), when unhandled, return() simply returns!
 * Removal of functionality::
 * - Remove static utility methods.
 * - Remove buffer functionality.
 * - Remove queue limits.
 * Additional minor changes:
 * - Use `PromiseOrValue` utility type.
 * - Try to avoid a few extra ticks at the expense of readability.
 * - Use named arguments for the executor.
 * - Separate the stop function from the stopped promise.
 * - Use TS enum for internal repeater states.
 * - A few TS tweaks.
 * - Rename state 'Done' to 'Finished' to match the function.
 * - Variable renaming to make spell-check happy.
 */

import type { PromiseOrValue } from './PromiseOrValue';

/** Makes sure promise-likes don't cause unhandled or asynchronously handled rejections. */
function swallow(value: any): void {
  if (value != null && typeof value.then === 'function') {
    value.then(undefined, NOOP);
  }
}

/** CLASSES **/

/**
 * Objects of this class indicate closure of a Repeater.
 * @internal
 * */
export class RepeaterClosureSignal<TReturn> {
  returnValue: TReturn;

  constructor(returnValue: TReturn) {
    this.returnValue = returnValue;
  }
}

/** TYPES **/
/** The type of the push property passed to the executor callback. */
export type Push<T, TNext = unknown> = (
  promiseOrValue: PromiseOrValue<T>,
) => Promise<TNext | undefined>;

/** The type of the stop property passed to the executor callback. */
export type Stop = (err?: unknown) => undefined;

/** The type of the stopped property passed to the executor callback. */
export type Stopped = Promise<undefined>;

export interface RepeaterExecutorOptions<T, TNext = unknown> {
  push: Push<T, TNext>;
  stop: Stop;
  stopped: Promise<undefined>;
}

/** The type of the callback passed to the Repeater constructor. */
export type RepeaterExecutor<T, TReturn = any, TNext = unknown> = (
  options: RepeaterExecutorOptions<T, TNext>,
) => PromiseOrValue<TReturn>;

/** The type of the object passed to the push queue. */
interface PushOperation<T, TNext> {
  // The value passed to the push function.
  value: Promise<T | undefined>;
  // The resolve function of the promise returned from push.
  resolve: (next?: PromiseLike<TNext> | TNext) => unknown;
}

/** The type of the object passed to the next queue. */
interface NextOperation<T, TReturn, TNext> {
  // The value passed to the next method.
  value: PromiseLike<TNext> | TNext | undefined;
  // The resolve function of the promise returned from next.
  resolve: (iteration: PromiseOrValue<IteratorResult<T, TReturn>>) => unknown;
}

/** REPEATER STATES **/

/** The following is an enumeration of all possible repeater states. These states are ordered, and a repeater may only advance to higher states. */
enum RepeaterState {
  /** The initial state of the repeater. */
  Initial = 0,
  /** Repeaters advance to this state the first time the next method is called on the repeater. */
  Started = 1,
  /** Repeaters advance to this state when the stop function is called. */
  Stopped = 2,
  /** Repeaters advance to this state when there are no values left to be pulled from the repeater. */
  Finished = 3,
  /** Repeaters advance to this state if an error is thrown into the repeater. */
  Rejected = 4,
}

const NOOP = () => undefined;

/** An interface containing the private data of repeaters, only accessible through a private WeakMap. */
interface RepeaterRecord<T, TReturn, TNext> {
  // A number enum. States are ordered and the repeater will move through these states over the course of its lifetime. See REPEATER STATES.
  state: RepeaterState;

  // The function passed to the repeater constructor.
  executor: RepeaterExecutor<T, TReturn, TNext>;

  // A queue of values which were pushed.
  pushQueue: Array<PushOperation<T, TNext>>;

  // A queue of requests for values.
  nextQueue: Array<NextOperation<T, TReturn, TNext>>;
  // NOTE: both the push queue and the next queue will never contain values at the same time.

  // A promise which is continuously reassigned and chained so that all repeater iterations settle in order.
  pending: Promise<unknown> | undefined;

  // The return value of the executor.
  execution: Promise<TReturn | undefined> | undefined;

  // An error passed to the stop function.
  err: unknown;

  // A callback set to the resolve function of the promise returned from push.
  onNext: (value?: PromiseLike<TNext> | TNext) => unknown;

  // A callback set to the resolve function of the stopped promise.
  onStopped: (value?: any) => unknown;
}

/** A helper function used to mimic the behavior of async generators where the final iteration is consumed. */
function consumeExecution<T, TReturn, TNext>(
  r: RepeaterRecord<T, TReturn, TNext>,
): Promise<TReturn | undefined> {
  const err = r.err;

  const execution: Promise<TReturn | undefined> = Promise.resolve(r.execution)
    .then((value) => {
      if (err != null) {
        throw err;
      }

      return value;
    })
    .catch((possibleClosureSignal) => {
      if (possibleClosureSignal instanceof RepeaterClosureSignal) {
        return possibleClosureSignal.returnValue;
      }
      throw possibleClosureSignal;
    });
  r.execution = execution.then(
    () => undefined,
    () => undefined,
  );

  r.err = undefined;

  return r.pending === undefined ? execution : r.pending.then(() => execution);
}

/** Helper functions for building iterations from values. Promises are unwrapped, so that iterations never have their value property set to a promise. */
async function createIteration<T, TReturn, TNext>(
  r: RepeaterRecord<T, TReturn, TNext>,
  value: Promise<T | TReturn | undefined>,
): Promise<IteratorResult<T, TReturn>> {
  const done = r.state >= RepeaterState.Finished;

  const resolvedValue = await value;

  if (!done && r.state >= RepeaterState.Rejected) {
    // If the repeater entered the 'Rejected' state while awaiting the value, the just resolved value is swallowed.
    const finalValue = await consumeExecution(r);
    return {
      // This cast is necessary because if the executor was already consumed, re-consuming returns undefined. Type safety is only strictly guaranteed (with respect to undefined) in the case of the first final iteration produced!
      value: finalValue as TReturn,
      done: true,
    };
  }

  // if the resolvedValue is of type TReturn, done is true.
  return { value: resolvedValue, done } as IteratorResult<T, TReturn>;
}

/**
 * This function is bound and passed to the executor as the stop argument.
 *
 * Advances state to Stopped.
 */
function stop<T, TReturn, TNext>(
  r: RepeaterRecord<T, TReturn, TNext>,
  err?: unknown,
): void {
  if (r.state >= RepeaterState.Stopped) {
    return;
  }

  r.state = RepeaterState.Stopped;
  r.onNext();
  r.onStopped();
  if (r.err == null) {
    r.err = err;
  }

  if (r.pushQueue.length === 0) {
    finish(r);
  } else {
    for (const pendingPush of r.pushQueue) {
      pendingPush.resolve();
    }
  }
}

/**
 * The difference between stopping a repeater vs finishing a repeater is that stopping a repeater allows next to continue to drain values from the push queue, while finishing a repeater will clear all pending values and end iteration immediately. Once, a repeater is finished, all iterations will have the done property set to true.
 *
 * Advances state to Finished.
 */
function finish<T, TReturn, TNext>(r: RepeaterRecord<T, TReturn, TNext>): void {
  if (r.state >= RepeaterState.Finished) {
    return;
  }

  if (r.state < RepeaterState.Stopped) {
    stop(r);
  }

  r.state = RepeaterState.Finished;
  for (const next of r.nextQueue) {
    const execution: Promise<TReturn | undefined> =
      r.pending === undefined
        ? consumeExecution<T, TReturn, TNext>(r)
        : r.pending.then(() => consumeExecution<T, TReturn, TNext>(r));
    next.resolve(createIteration<T, TReturn, TNext>(r, execution));
  }

  r.pushQueue = [];
  r.nextQueue = [];
}

/**
 * Called when a promise passed to push rejects, or when a push call is unhandled.
 *
 * Advances state to Rejected.
 */
function reject<T, TReturn, TNext>(r: RepeaterRecord<T, TReturn, TNext>): void {
  if (r.state >= RepeaterState.Rejected) {
    return;
  }

  if (r.state < RepeaterState.Finished) {
    finish(r);
  }

  r.state = RepeaterState.Rejected;
}

/** This function is bound and passed to the executor as the push argument. */
function push<T, TReturn, TNext>(
  r: RepeaterRecord<T, TReturn, TNext>,
  value: PromiseOrValue<T>,
): Promise<TNext | undefined> {
  swallow(value);
  if (r.state >= RepeaterState.Stopped) {
    return Promise.resolve(undefined);
  }

  let valueP: Promise<T | undefined> =
    r.pending === undefined
      ? Promise.resolve(value)
      : r.pending.then(() => value);

  valueP = valueP.catch((err) => {
    if (r.state < RepeaterState.Stopped) {
      r.err = err;
    }

    reject(r);
    return undefined; // void :(
  });

  let nextP: Promise<TNext | undefined>;
  const [pendingNext, ...nextQueue] = r.nextQueue;
  if (pendingNext) {
    r.nextQueue = nextQueue;
    pendingNext.resolve(createIteration<T, TReturn, TNext>(r, valueP));
    if (nextQueue.length) {
      nextP = Promise.resolve(nextQueue[0].value);
    } else {
      nextP = new Promise((resolve) => (r.onNext = resolve));
    }
  } else {
    nextP = new Promise((resolve) =>
      r.pushQueue.push({ resolve, value: valueP }),
    );
  }

  // If an error is thrown into the repeater via the next, throw, or return methods, we give the repeater a chance to handle this by rejecting the promise returned from push. If the push call is not immediately handled we throw the next iteration of the repeater.
  // To check that the originalPromise is floating, we modify the then and catch methods of the returned promise so that they flip the floating flag. This function actually does not return a promise, because modern engines do not call the then and catch methods on native promises. By making the returned promise a plain old javascript object, we ensure that the then and catch methods will be called.
  let floating = true;
  const unhandled = nextP.catch((err) => {
    if (floating) {
      throw err;
    }

    return undefined; // void :(
  });
  swallow(unhandled);

  const next = {} as Promise<TNext | undefined>;
  next.then = (onfulfilled, onrejected): any => {
    floating = false;
    return Promise.prototype.then.call(nextP, onfulfilled, onrejected);
  };

  next.catch = (onrejected): any => {
    floating = false;
    return Promise.prototype.catch.call(nextP, onrejected);
  };

  next.finally = nextP.finally.bind(nextP);

  r.pending = valueP
    .then(() => unhandled)
    .catch((err) => {
      r.err = err;
      reject(r);
    });

  return next;
}

/**
 * Calls the executor passed into the constructor. This function is called the first time the next method is called on the repeater.
 *
 * Advances state to Started.
 */
function execute<T, TReturn, TNext>(
  r: RepeaterRecord<T, TReturn, TNext>,
): void {
  r.state = RepeaterState.Started;
  const push1 = (push as typeof push<T, TReturn, TNext>).bind(null, r);
  const stop1 = stop.bind(null, r) as Stop;
  const stopped1 = new Promise<undefined>((resolve) => (r.onStopped = resolve));
  // See: https://stackoverflow.com/questions/26711243/promise-resolve-vs-new-promiseresolve
  try {
    r.execution = Promise.resolve(
      r.executor({
        push: push1,
        stop: stop1,
        stopped: stopped1,
      }),
    );
  } catch (err) {
    r.execution = Promise.reject(err);
  }
  // TODO: We should consider stopping all repeaters when the executor settles.
  r.execution.catch(() => stop(r));
}

type RecordMap<T, TResult, TNext> = WeakMap<
  Repeater<T, TResult, TNext>,
  RepeaterRecord<T, TResult, TNext>
>;

let records: RecordMap<any, any, any>;

function createRepeaterRecord<T, TReturn, TNext>(
  repeater: Repeater<T, TReturn, TNext>,
  executor: RepeaterExecutor<T, TReturn, TNext>,
): void {
  if (records === undefined) {
    records = new WeakMap();
  }

  records.set(repeater, {
    executor,
    err: undefined,
    state: RepeaterState.Initial,
    pushQueue: [],
    nextQueue: [],
    pending: undefined,
    execution: undefined,
    onNext: NOOP,
    onStopped: NOOP,
  });
}

function getRepeaterRecord<T, TReturn, TNext>(
  repeater: Repeater<T, TReturn, TNext>,
): RepeaterRecord<T, TReturn, TNext> {
  const r = records.get(repeater);

  if (r === undefined) {
    throw new Error('WeakMap error');
  }

  return r;
}

/**
 * An error subclass which is thrown when there are too many pending push or next operations on a single repeater.
 * NOTE: While repeaters implement and are assignable to the AsyncGenerator interface, and you can use the types interchangeably, we don't use typescript's implements syntax here because this would make supporting earlier versions of typescript trickier. This is because TypeScript version 3.6 changed the iterator types by adding the TReturn and TNext type parameters.
 *
 * @internal
 */
export class Repeater<T, TReturn = any, TNext = unknown> {
  constructor(executor: RepeaterExecutor<T, TReturn, TNext>) {
    createRepeaterRecord(this, executor);
  }

  next(
    value?: PromiseLike<TNext> | TNext,
  ): Promise<IteratorResult<T, TReturn>> {
    swallow(value);
    const r = getRepeaterRecord(this);

    if (r.state <= RepeaterState.Initial) {
      execute(r);
    }

    // Call existing next handler with the passed value.
    r.onNext(value);

    const [pendingPush, ...pushQueue] = r.pushQueue;
    // If the push queue is not empty, we return a promise that resolves when the last pushed value resolves.
    if (pendingPush) {
      // Pop the next push operation from the queue.
      r.pushQueue = pushQueue;

      // Reset the next handler.
      r.onNext = pendingPush.resolve;

      // Return the value.
      return createIteration(r, pendingPush.value);
    }

    if (r.state >= RepeaterState.Stopped) {
      finish(r);
      return createIteration(r, consumeExecution(r));
    }

    return new Promise((resolve) => r.nextQueue.push({ resolve, value }));
  }

  return(
    value?: PromiseLike<TReturn> | TReturn,
  ): Promise<IteratorResult<T, TReturn>> {
    const r = getRepeaterRecord(this);

    if (r.state <= RepeaterState.Initial || r.state >= RepeaterState.Stopped) {
      finish(r);

      return createIteration(
        r,
        // We override the execution because return should always return the value passed in.
        consumeExecution(r).then(() => value),
      );
    }

    return this.next(Promise.reject(new RepeaterClosureSignal(value)));
  }

  throw(err: unknown): Promise<IteratorResult<T, TReturn>> {
    const r = getRepeaterRecord(this);

    if (r.state <= RepeaterState.Initial || r.state >= RepeaterState.Stopped) {
      finish(r);
      // If r.err is already set, that mean the repeater has already produced an error, so we throw that error rather than the error passed in, because doing so might be more informative for the caller.
      if (r.err == null) {
        r.err = err;
      }

      return createIteration(r, consumeExecution(r));
    }

    return this.next(Promise.reject(err));
  }

  [Symbol.asyncIterator](): this {
    return this;
  }
}
