import { inspect } from './inspect';

/**
 * Sometimes a non-error is thrown, wrap it as an Error instance to ensure a consistent Error interface.
 */
export function toError(thrownValue: unknown): Error {
  return thrownValue instanceof Error
    ? thrownValue
    : new NonErrorThrown(thrownValue);
}

class NonErrorThrown extends Error {
  thrownValue: unknown;

  constructor(thrownValue: unknown) {
    super('Unexpected error value: ' + inspect(thrownValue));
    this.name = 'NonErrorThrown';
    this.thrownValue = thrownValue;
  }
}
