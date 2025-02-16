/**
 * A replacement for instanceof which includes an error warning when multi-realm
 * constructors are detected.
 * See: https://expressjs.com/en/advanced/best-practice-performance.html#set-node_env-to-production
 * See: https://webpack.js.org/guides/production/
 */
export function instanceOf(value: unknown, constructor: Constructor): boolean {
  if (value instanceof constructor) {
    return true;
  }
  if (typeof value === 'object' && value !== null) {
    const className = constructor.prototype[Symbol.toStringTag];
    const valueClassName =
      // We still need to support constructor's name to detect conflicts with older versions of this library.
      Symbol.toStringTag in value
        ? value[Symbol.toStringTag]
        : value.constructor?.name;
    if (className === valueClassName) {
      throw new Error(
        `Multiple GraphQL instances detected, Cannot use ${className} from another module or realm. Read more at https://graphql-js.org/errors/conflicting-versions`,
      );
    }
  }
  return false;
}

interface Constructor {
  prototype: {
    [Symbol.toStringTag]: string;
  };
  new (...args: Array<any>): any;
}
