import { assert } from 'chai';

import { isPromise } from '../jsutils/isPromise.ts';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.ts';

import type { MatchingOutcome, MatchingValue } from './expectMatchingValues.ts';
import {
  captureMatchingValue,
  expectMatchingOutcomes,
  expectMatchingValues,
} from './expectMatchingValues.ts';

type PromiseOrValueOrThunk<T> = MatchingValue<PromiseOrValue<T>>;

export function expectEqualPromisesOrValues<T>(
  items: ReadonlyArray<PromiseOrValueOrThunk<T>>,
): PromiseOrValue<T> {
  const outcomes = items.map(captureMatchingValue);
  const [firstOutcome] = outcomes;
  assert(firstOutcome !== undefined, 'Expected at least one item.');

  if (outcomes.some((outcome) => outcome.kind === 'error')) {
    if (
      outcomes.some((outcome) => outcome.kind === 'value') &&
      outcomes.every(
        (outcome) => outcome.kind === 'error' || isPromise(outcome.value),
      )
    ) {
      return Promise.all(
        outcomes.map(async (outcome) => {
          if (outcome.kind === 'error') {
            return outcome;
          }

          assert(isPromise(outcome.value));
          try {
            return { kind: 'value', value: await outcome.value } as const;
          } catch (error) {
            return { kind: 'error', error } as const;
          }
        }),
      ).then(expectMatchingOutcomes);
    }
    return expectMatchingOutcomes(outcomes);
  }

  const values = outcomes.map((outcome) => {
    assert(outcome.kind === 'value');
    return outcome.value;
  });
  const [firstItem, ...remainingItems] = values;
  if (isPromise(firstItem)) {
    if (remainingItems.every(isPromise)) {
      return Promise.allSettled(values).then((settledItems) =>
        expectMatchingOutcomes(settledItems.map(outcomeFromSettledItem)),
      );
    }
  } else if (remainingItems.every((item) => !isPromise(item))) {
    return expectMatchingValues(
      (values as ReadonlyArray<T>).map((value) => () => value),
    );
  }

  assert(false, 'Received an invalid mixture of promises and values.');
}

function outcomeFromSettledItem<T>(
  settledItem: PromiseSettledResult<T>,
): MatchingOutcome<T> {
  if (settledItem.status === 'fulfilled') {
    return { kind: 'value', value: settledItem.value };
  }
  return { kind: 'error', error: settledItem.reason };
}
