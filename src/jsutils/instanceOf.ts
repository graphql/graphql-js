import { inspect } from './inspect.js';

/**
 * A replacement for instanceof relying on a symbol-driven type brand which in
 * development mode includes an error warning when multi-realm constructors are
 * detected.
 * See: https://expressjs.com/en/advanced/best-practice-performance.html#set-node_env-to-production
 * See: https://webpack.js.org/guides/production/
 */
function devInstanceOf(
  value: unknown,
  symbol: symbol,
  constructor: Constructor,
): boolean {
  if ((value as any)?.__kind === symbol) {
    return true;
  }
  if (typeof value === 'object' && value !== null) {
    // Prefer Symbol.toStringTag since it is immune to minification.
    const className = constructor.prototype[Symbol.toStringTag];
    const valueClassName =
      // We still need to support constructor's name to detect conflicts with older versions of this library.
      Symbol.toStringTag in value
        ? value[Symbol.toStringTag]
        : value.constructor?.name;
    if (className === valueClassName) {
      const stringifiedValue = inspect(value);
      throw new Error(
        `Cannot use ${className} "${stringifiedValue}" from another module or realm.

Ensure that there is only one instance of "graphql" in the node_modules
directory. If different versions of "graphql" are the dependencies of other
relied on modules, use "resolutions" to ensure only one version is installed.

https://yarnpkg.com/en/docs/selective-version-resolutions

Duplicate "graphql" modules cannot be used at the same time since different
versions may have different capabilities and behavior. The data from one
version used in the function from another could produce confusing and
spurious results.`,
      );
    }
  }
  return false;
}

function prodInstanceOf(value: unknown, symbol: symbol): boolean {
  return (value as any)?.__kind === symbol;
}

interface Constructor {
  prototype: {
    [Symbol.toStringTag]: string;
  };
  new (...args: Array<any>): any;
}

interface Constructor {
  prototype: {
    [Symbol.toStringTag]: string;
  };
  new (...args: Array<any>): any;
}

/* eslint-disable-next-line import/no-mutable-exports */
export let instanceOf: (
  value: unknown,
  symbol: symbol,
  constructor: Constructor,
) => boolean = prodInstanceOf;

export function enableDevInstanceOf(): void {
  instanceOf = devInstanceOf;
}
