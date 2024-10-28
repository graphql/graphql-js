import { inspect } from './inspect.js';

/**
 * Sometimes a non-error is provided, either thrown within a resolver or as an rejection/abort reason,
 * wrap it as an Error instance to ensure a consistent Error interface.
 */
export function toError(rawError: unknown): Error {
  return rawError instanceof Error
    ? rawError
    : new WrappedNonErrorValueError(rawError);
}

class WrappedNonErrorValueError extends Error {
  rawError: unknown;

  constructor(rawError: unknown) {
    super('Encountered error: ' + inspect(rawError));
    this.name = 'WrappedNonErrorValueError';
    this.rawError = rawError;
  }
}
