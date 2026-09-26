import { assert } from 'chai';

import {
  expectMatchingErrors,
  expectMatchingValues,
} from './expectMatchingValues.ts';
import { createReplayableAsyncIterablePair } from './replayableIterables.ts';

interface AsyncIteratorOutcome<T> {
  readonly results: ReadonlyArray<IteratorResult<T, void>>;
  readonly hasError: boolean;
  readonly error: unknown;
}

export type AsyncIterableValuesComparator<T> = (
  valuesByIterable: ReadonlyArray<ReadonlyArray<T>>,
) => void;

export function expectMatchingAsyncIterables<T>(
  iterables: ReadonlyArray<AsyncIterable<T>>,
): AsyncGenerator<T, void, void> {
  const [firstIterable, ...remainingIterables] = iterables;
  assert(firstIterable !== undefined, 'Expected at least one async iterable.');

  const [recordingIterable, replayIterable] =
    createReplayableAsyncIterablePair(firstIterable);
  const firstIterator = recordingIterable[Symbol.asyncIterator]();
  const remainingIterators = remainingIterables.map((iterable) =>
    iterable[Symbol.asyncIterator](),
  );
  let hasComparedResults = false;
  let isClosed = false;

  return {
    async next() {
      if (isClosed) {
        return { done: true, value: undefined };
      }

      let result: IteratorResult<T, void>;
      try {
        result = normalizeIteratorResult(await firstIterator.next());
      } catch (error) {
        closeComparison();
        await compareRemainingIterators();
        throw error;
      }

      if (isClosed) {
        return { done: true, value: undefined };
      }

      if (result.done === true) {
        await compareRemainingIterators();
      }

      return result;
    },
    async return() {
      isClosed = true;
      await firstIterator.return?.();
      await closeRemainingIterators();
      return { done: true, value: undefined };
    },
    async throw(error) {
      isClosed = true;
      try {
        await firstIterator.return?.();
        throw error;
      } finally {
        await closeRemainingIterators();
      }
    },
    async [Symbol.asyncDispose]() {
      await this.return();
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };

  async function compareRemainingIterators(): Promise<void> {
    if (hasComparedResults) {
      return;
    }
    hasComparedResults = true;

    const expectedOutcome = await collectAsyncIteratorOutcome(
      replayIterable[Symbol.asyncIterator](),
    );
    for (const iterator of remainingIterators) {
      // eslint-disable-next-line no-await-in-loop
      const actualOutcome = await collectAsyncIteratorOutcome(iterator);
      expectMatchingIteratorOutcome(expectedOutcome, actualOutcome);
    }
  }

  async function closeRemainingIterators(): Promise<void> {
    for (const iterator of remainingIterators) {
      // eslint-disable-next-line no-await-in-loop
      await iterator.return?.();
    }
  }

  function closeComparison(): void {
    isClosed = true;
  }
}

export function expectMatchingAsyncIterablesConcurrently<T>(
  iterables: ReadonlyArray<AsyncIterable<T>>,
  compareValues: AsyncIterableValuesComparator<T> = expectMatchingValueBatches,
): AsyncGenerator<T, void, void> {
  const [firstIterable, ...remainingIterables] = iterables;
  assert(firstIterable !== undefined, 'Expected at least one async iterable.');

  const firstIterator = firstIterable[Symbol.asyncIterator]();
  const comparisons = remainingIterables.map((iterable) => ({
    iterator: iterable[Symbol.asyncIterator](),
    pendingNextResults: [] as Array<Promise<IteratorResult<T, unknown>>>,
    nextResultIndex: 0,
    values: [] as Array<T>,
  }));
  const firstValues: Array<T> = [];
  let hasComparedResults = false;
  let isClosed = false;

  return {
    async next() {
      if (isClosed) {
        return { done: true, value: undefined };
      }

      for (const comparison of comparisons) {
        const nextResult = comparison.iterator.next();
        nextResult.catch(() => undefined);
        comparison.pendingNextResults.push(nextResult);
      }

      let result: IteratorResult<T, void>;
      try {
        result = normalizeIteratorResult(await firstIterator.next());
      } catch (error) {
        // eslint-disable-next-line require-atomic-updates
        isClosed = true;
        await closeRemainingIterators();
        throw error;
      }

      if (isClosed) {
        return { done: true, value: undefined };
      }

      if (result.done === true) {
        await collectRemainingValues();
        compareCollectedValues();
      } else {
        firstValues.push(result.value);
      }

      return result;
    },
    async return() {
      isClosed = true;
      const firstReturn = firstIterator.return?.();
      const remainingReturns = comparisons.map((comparison) =>
        Promise.resolve(comparison.iterator.return?.()),
      );
      await firstReturn;
      await Promise.all(remainingReturns);
      return { done: true, value: undefined };
    },
    async throw(error) {
      isClosed = true;
      try {
        if (firstIterator.throw !== undefined) {
          return await firstIterator.throw(error);
        }
        throw error;
      } finally {
        await throwIntoRemainingIterators(error);
      }
    },
    async [Symbol.asyncDispose]() {
      await this.return();
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };

  async function collectRemainingValues(): Promise<void> {
    for (const comparison of comparisons) {
      // eslint-disable-next-line no-await-in-loop
      await collectComparisonValues(comparison);
    }
  }

  function compareCollectedValues(): void {
    if (hasComparedResults) {
      return;
    }
    hasComparedResults = true;
    compareValues([
      firstValues,
      ...comparisons.map((comparison) => comparison.values),
    ]);
  }

  async function closeRemainingIterators(): Promise<void> {
    for (const comparison of comparisons) {
      // eslint-disable-next-line no-await-in-loop
      await comparison.iterator.return?.();
    }
  }

  async function throwIntoRemainingIterators(error: unknown): Promise<void> {
    for (const comparison of comparisons) {
      if (comparison.iterator.throw !== undefined) {
        // eslint-disable-next-line no-await-in-loop
        await comparison.iterator.throw(error).catch(() => undefined);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await comparison.iterator.return?.();
      }
    }
  }
}

async function collectAsyncIteratorOutcome<T>(
  iterator: AsyncIterator<T>,
): Promise<AsyncIteratorOutcome<T>> {
  const results: Array<IteratorResult<T, void>> = [];

  while (true) {
    let result: IteratorResult<T, void>;
    try {
      // eslint-disable-next-line no-await-in-loop
      result = normalizeIteratorResult(await iterator.next());
    } catch (error) {
      // eslint-disable-next-line no-await-in-loop
      await iterator.return?.();
      return {
        results,
        hasError: true,
        error,
      };
    }

    results.push(result);
    if (result.done === true) {
      return {
        results,
        hasError: false,
        error: undefined,
      };
    }
  }
}

async function collectComparisonValues<T>(comparison: {
  iterator: AsyncIterator<T>;
  pendingNextResults: Array<Promise<IteratorResult<T, unknown>>>;
  nextResultIndex: number;
  values: Array<T>;
}): Promise<void> {
  while (comparison.nextResultIndex < comparison.pendingNextResults.length) {
    const pendingResult =
      comparison.pendingNextResults[comparison.nextResultIndex++];
    assert(pendingResult !== undefined);
    // eslint-disable-next-line no-await-in-loop
    const result = await pendingResult;
    if (result.done === true) {
      return;
    }
    comparison.values.push(result.value);
  }

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const result = await comparison.iterator.next();
    if (result.done === true) {
      return;
    }
    comparison.values.push(result.value);
  }
}

function normalizeIteratorResult<T>(
  result: IteratorResult<T, unknown>,
): IteratorResult<T, void> {
  return result.done === true ? { done: true, value: undefined } : result;
}

function expectMatchingIteratorOutcome<T>(
  expectedOutcome: AsyncIteratorOutcome<T>,
  actualOutcome: AsyncIteratorOutcome<T>,
): void {
  expectMatchingValues([
    () => expectedOutcome.results,
    () => actualOutcome.results,
  ]);
  expectMatchingValues([
    () => expectedOutcome.hasError,
    () => actualOutcome.hasError,
  ]);
  if (expectedOutcome.hasError) {
    expectMatchingErrors([expectedOutcome.error, actualOutcome.error]);
  }
}

function expectMatchingValueBatches(
  valuesByIterable: ReadonlyArray<ReadonlyArray<unknown>>,
): void {
  expectMatchingValues(valuesByIterable.map((values) => () => values));
}
