import { assert } from 'chai';

import { expectJSON } from './expectJSON.ts';

export type MatchingValue<T> = () => T;

export type MatchingOutcome<T> =
  | { readonly kind: 'value'; readonly value: T }
  | { readonly kind: 'error'; readonly error: unknown };

export function expectMatchingValues<T>(
  values: ReadonlyArray<MatchingValue<T>>,
): T {
  return expectMatchingOutcomes(values.map(captureMatchingValue));
}

export function captureMatchingValue<T>(
  value: MatchingValue<T>,
): MatchingOutcome<T> {
  try {
    return { kind: 'value', value: value() };
  } catch (error) {
    return { kind: 'error', error };
  }
}

export function expectMatchingOutcomes<T>(
  outcomes: ReadonlyArray<MatchingOutcome<T>>,
): T {
  const [firstOutcome, ...remainingOutcomes] = outcomes;
  assert(firstOutcome !== undefined, 'Expected at least one matching value.');

  if (firstOutcome.kind === 'error') {
    expectMatchingErrors([
      firstOutcome.error,
      ...remainingOutcomes.map((outcome) => {
        assert(
          outcome.kind === 'error',
          'Received an invalid mixture of thrown errors and values.',
        );
        return outcome.error;
      }),
    ]);
    throw firstOutcome.error;
  }

  const firstValue = firstOutcome.value;
  for (const outcome of remainingOutcomes) {
    assert(
      outcome.kind === 'value',
      'Received an invalid mixture of values and thrown errors.',
    );
    expectJSON(outcome.value).toDeepEqual(firstValue);
  }
  return firstValue;
}

export function expectMatchingErrors(errors: ReadonlyArray<unknown>): void {
  assert(errors.length > 0, 'Expected at least one matching error.');
  const [firstError, ...remainingErrors] = errors;

  for (const error of remainingErrors) {
    expectJSON(errorToComparableValue(error)).toDeepEqual(
      errorToComparableValue(firstError),
    );
  }
}

function errorToComparableValue(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    message: error.message,
  };
}
