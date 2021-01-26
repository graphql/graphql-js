import { SYMBOL_TO_STRING_TAG } from '../polyfills/symbols';

/**
 * A replacement for instanceof which includes an error warning when multi-realm
 * constructors are detected.
 * See: https://expressjs.com/en/advanced/best-practice-performance.html#set-node_env-to-production
 * See: https://webpack.js.org/guides/production/
 */
export const instanceOf: (mixed, mixed) => boolean =
  process.env.NODE_ENV === 'production'
    ? // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2317')
      function instanceOf(value: mixed, constructor: mixed): boolean {
        return value instanceof constructor;
      }
    : function instanceOf(value: any, constructor: any): boolean {
        if (value instanceof constructor) {
          return true;
        }
        if (value) {
          const proto = constructor && constructor.prototype;
          const classTag = proto && proto[SYMBOL_TO_STRING_TAG];
          const className = classTag || constructor.name;
          // When the constructor class defines a Symbol.toStringTag
          // property, as most classes exported by graphql-js do, use it
          // instead of constructor.name and value.constructor.name to
          // detect module/realm duplication, since the Symbol.toStringTag
          // string is immune to minification. This code runs only when
          // process.env.NODE_ENV !== 'production', but minification is
          // often enabled in non-production environments like 'staging'.
          // In these environments, this error can be thrown mistakenly if
          // we rely on constructor.name and value.constructor.name, since
          // they could be minified to the same short string, even though
          // value is legitimately _not_ instanceof constructor.
          const valueName = classTag
                ? value[SYMBOL_TO_STRING_TAG]
                : value.constructor && value.constructor.name;
          if (typeof className === 'string' && valueName === className) {
            throw new Error(
              `Cannot use ${className} "${value}" from another module or realm.

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
