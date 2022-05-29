import type { GraphQLEntityKind } from '../utilities/entities';
import { isEntity, ofVersion } from '../utilities/entities';

import { inspect } from './inspect';
import { isObjectLike } from './isObjectLike';

/**
 * A replacement for instanceof which:
 * 1. uses cross-realm symbols
 * 2. includes an error warning with different versions
 * See: https://expressjs.com/en/advanced/best-practice-performance.html#set-node_env-to-production
 * See: https://webpack.js.org/guides/production/
 */
export const instanceOf: (value: unknown, type: GraphQLEntityKind) => boolean =
  /* c8 ignore next 6 */
  // FIXME: https://github.com/graphql/graphql-js/issues/2317
  globalThis.process?.env.NODE_ENV === 'production'
    ? function instanceOf(value: unknown, type: GraphQLEntityKind): boolean {
        return isObjectLike(value) && isEntity(value, type);
      }
    : function instanceOf(value: unknown, type: GraphQLEntityKind): boolean {
        if (!isObjectLike(value)) {
          return false;
        }

        if (isEntity(value, type)) {
          if (!ofVersion(value)) {
            const stringifiedValue = inspect(value);
            throw new Error(
              `Cannot use value "${stringifiedValue}" for entity type "${type}".
The value is tagged with a different version of "graphql".

Ensure that there is only one version of "graphql" in the node_modules
directory. If different versions of "graphql" are the dependencies of other
relied on modules, use "resolutions" to ensure only one version is installed.

https://yarnpkg.com/en/docs/selective-version-resolutions

Duplicate "graphql" modules of different versions cannot be used at the same
time since different versions may have different capabilities and behavior.
The data from one version used in the function from another could produce
confusing and spurious results.`,
            );
          }
          return true;
        }

        return false;
      };
