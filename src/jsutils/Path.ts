import type { Maybe } from './Maybe';

export interface Path {
  readonly prev: Path | undefined;
  readonly key: string | number;
  readonly typename: string | undefined;
  readonly nonNull: boolean;
}

export interface PathDigest {
  readonly path: ReadonlyArray<string | number>;
  readonly pathNonNull: ReadonlyArray<boolean>;
}

/**
 * Given a Path and a key, return a new Path containing the new key.
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
 */
export function pathToArray(
  path: Maybe<Readonly<Path>>,
): Array<string | number> {
  return [...pathToDigest(path).path];
}
