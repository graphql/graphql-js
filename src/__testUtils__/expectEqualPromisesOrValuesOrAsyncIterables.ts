import { assert } from 'chai';

import { isAsyncIterable } from '../jsutils/isAsyncIterable.ts';
import { isPromise } from '../jsutils/isPromise.ts';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.ts';

import { expectMatchingAsyncIterablesConcurrently } from './expectMatchingAsyncIterables.ts';
import type { MatchingOutcome, MatchingValue } from './expectMatchingValues.ts';
import {
  captureMatchingValue,
  expectMatchingOutcomes,
  expectMatchingValues,
} from './expectMatchingValues.ts';

type PromiseOrValueOrAsyncIterableOrThunk<T> = MatchingValue<
  PromiseOrValue<T | AsyncIterable<T>>
>;

export function expectEqualPromisesOrValuesOrAsyncIterables<T>(
  items: ReadonlyArray<PromiseOrValueOrAsyncIterableOrThunk<T>>,
): PromiseOrValue<T | AsyncGenerator<T, void, void>> {
  const outcomes = items.map(captureMatchingValue);
  const [firstOutcome] = outcomes;
  assert(firstOutcome !== undefined, 'Expected at least one item.');

  if (outcomes.some((outcome) => outcome.kind === 'error')) {
    expectMatchingOutcomes(outcomes);
    assert(false, 'Expected matching errors to throw.');
  }

  const values = outcomes.map((outcome) => {
    assert(outcome.kind === 'value');
    return outcome.value;
  });
  const [firstItem, ...remainingItems] = values;
  if (isPromise(firstItem)) {
    if (remainingItems.every(isPromise)) {
      return Promise.allSettled(
        values as ReadonlyArray<Promise<T | AsyncIterable<T>>>,
      ).then((settledItems) =>
        expectMatchingResolvedOutcomes(
          settledItems.map(outcomeFromSettledItem),
        ),
      );
    }
  } else if (remainingItems.every((item) => !isPromise(item))) {
    return expectMatchingResolvedItems(
      values as ReadonlyArray<T | AsyncIterable<T>>,
    );
  }

  assert(false, 'Received an invalid mixture of promises and values.');
}

function expectMatchingResolvedOutcomes<T>(
  outcomes: ReadonlyArray<MatchingOutcome<T | AsyncIterable<T>>>,
): T | AsyncGenerator<T, void, void> {
  if (outcomes.some((outcome) => outcome.kind === 'error')) {
    expectMatchingOutcomes(outcomes);
    assert(false, 'Expected matching errors to throw.');
  }

  return expectMatchingResolvedItems(
    outcomes.map((outcome) => {
      assert(outcome.kind === 'value');
      return outcome.value;
    }),
  );
}

function expectMatchingResolvedItems<T>(
  items: ReadonlyArray<T | AsyncIterable<T>>,
): T | AsyncGenerator<T, void, void> {
  const [firstItem] = items;
  const firstIsAsyncIterable = isAsyncIterable(firstItem);

  if (!firstIsAsyncIterable) {
    for (const item of items) {
      assert(
        !isAsyncIterable(item),
        'Received an invalid mixture of async iterables and values.',
      );
    }
    return expectMatchingValues(
      (items as ReadonlyArray<T>).map((item) => () => item),
    );
  }

  const iterables = items.map((item) => {
    assert(
      isAsyncIterable(item),
      'Received an invalid mixture of async iterables and values.',
    );
    return item;
  });
  return expectMatchingAsyncIterablesConcurrently(iterables);
}

function outcomeFromSettledItem<T>(
  settledItem: PromiseSettledResult<T>,
): MatchingOutcome<T> {
  if (settledItem.status === 'fulfilled') {
    return { kind: 'value', value: settledItem.value };
  }
  return { kind: 'error', error: settledItem.reason };
}
