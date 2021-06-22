import { GraphQLError } from './GraphQLError';

/**
 * A GraphQLAggregateError is a container for multiple errors.
 *
 * This helper can be used to report multiple distinct errors simultaneously.
 * Note that error handlers must be aware aggregated errors may be reported so as to
 * properly handle the contained errors.
 *
 * See also:
 * https://tc39.es/ecma262/multipage/fundamental-objects.html#sec-aggregate-error-objects
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError
 * https://github.com/zloirock/core-js/blob/master/packages/core-js/modules/es.aggregate-error.js
 * https://github.com/sindresorhus/aggregate-error
 *
 */
export class GraphQLAggregateError<T = Error> extends Error {
  readonly errors!: ReadonlyArray<T>;

  constructor(errors: ReadonlyArray<T>, message?: string) {
    super(message);

    Object.defineProperties(this, {
      name: { value: 'GraphQLAggregateError' },
      message: {
        value: message,
        writable: true,
      },
      errors: {
        value: errors,
      },
    });
  }

  get [Symbol.toStringTag](): string {
    return 'GraphQLAggregateError';
  }
}

export function isAggregateOfGraphQLErrors(
  error: unknown,
): error is GraphQLAggregateError<GraphQLError> {
  return (
    error instanceof GraphQLAggregateError &&
    error.errors.every((subError) => subError instanceof GraphQLError)
  );
}
