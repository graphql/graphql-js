/** @category Paths */

import type { Maybe } from './Maybe';

/** Represents a linked response path from a field back to the root response. */
export interface Path {
  /** The previous segment in the linked response path, or undefined at the root. */
  readonly prev: Path | undefined;
  /** The field name or list index for this response path segment. */
  readonly key: string | number;
  /** The runtime object type name associated with this path segment, if known. */
  readonly typename: string | undefined;
  /** Whether this response path segment resolves through a non-null type. */
  readonly nonNull: boolean;
}

/**
 * A flattened response path and the nullability metadata for each segment.
 */
export interface PathDigest {
  /** Response path keys from root to leaf. */
  readonly path: ReadonlyArray<string | number>;
  /** Whether each response path segment resolves through a non-null type. */
  readonly pathNonNull: ReadonlyArray<boolean>;
}

/**
 * Given a Path and a key, return a new Path containing the new key.
 *
 * @internal
 */
export function addPath(
  prev: Readonly<Path> | undefined,
  key: string | number,
  typename: string | undefined,
  nonNull: boolean,
): Path {
  return { prev, key, typename, nonNull };
}

/**
 * Given a Path, return an object containing:
 *
 * - path: an Array of the path keys.
 * - pathNonNull: an Array of the `nonNull` value for each path entry.
 * @param pathLinkedList - The linked response path to flatten.
 * @returns The flattened path and nullability metadata.
 * @example
 * ```ts
 * const path = addPath(undefined, 'viewer', 'Query', false);
 *
 * pathToDigest(path);
 * // { path: ['viewer'], pathNonNull: [false] }
 * ```
 */
export function pathToDigest(
  pathLinkedList: Maybe<Readonly<Path>>,
): PathDigest {
  const path: Array<string | number> = [];
  const pathNonNull: Array<boolean> = [];
  let curr = pathLinkedList;
  while (curr) {
    path.push(curr.key);
    pathNonNull.push(curr.nonNull);
    curr = curr.prev;
  }
  path.reverse();
  pathNonNull.reverse();
  return { path, pathNonNull };
}

// To be deprecated in favour of pathToDigest when the `onError` experiment is accepted
/**
 * Given a Path, return an Array of the path keys.
 * @param path - The linked response path to flatten.
 * @returns An array of response path keys from root to leaf.
 * @example
 * ```ts
 * import { pathToArray } from 'graphql/jsutils/Path';
 *
 * const path = {
 *   prev: {
 *     prev: {
 *       prev: undefined,
 *       key: 'viewer',
 *       typename: 'Query',
 *     },
 *     key: 'friends',
 *     typename: 'User',
 *   },
 *   key: 0,
 *   typename: undefined,
 * };
 *
 * pathToArray(path); // => ['viewer', 'friends', 0]
 * pathToArray(undefined); // => []
 * ```
 */
export function pathToArray(
  path: Maybe<Readonly<Path>>,
): Array<string | number> {
  return [...pathToDigest(path).path];
}
