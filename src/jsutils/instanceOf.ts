import { inspect } from './inspect';

/**
 * A replacement for instanceof which includes an error warning when multi-realm
 * constructors are detected.
 * See: https://expressjs.com/en/advanced/best-practice-performance.html#set-node_env-to-production
 * See: https://webpack.js.org/guides/production/
 */
export const instanceOf: (value: unknown, constructor: Constructor) => boolean =
  /* c8 ignore next 5 */
  // FIXME: https://github.com/graphql/graphql-js/issues/2317
  process.env.NODE_ENV === 'production'
    ? function instanceOf(value: unknown, constructor: Constructor): boolean {
        return value instanceof constructor;
      }
    : function instanceOf(value: unknown, constructor: Constructor): boolean {
        if (value instanceof constructor) {
          return true;
        }
        if (typeof value === 'object' && value !== null) {
          // Prefer Symbol.toStringTag since it is immune to minification.
          const className = constructor.prototype[Symbol.toStringTag];
          const valueClassName =
            // We still need to support constructor's name to detect conflicts with older versions of this library.
            Symbol.toStringTag in value
              ? // @ts-expect-error TS bug see, https://github.com/microsoft/TypeScript/issues/38009
                value[Symbol.toStringTag]
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
      };

interface Constructor extends Function {
  prototype: {
    [Symbol.toStringTag]: string;
  };
}
