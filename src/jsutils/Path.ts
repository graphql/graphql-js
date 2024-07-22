import type { Maybe } from './Maybe.js';

export interface Path {
  readonly prev: Path | undefined;
  readonly key: string | number;
  readonly typename: string | undefined;
  readonly fieldDepth: number;
}

/**
 * Given a Path and a key, return a new Path containing the new key.
 */
export function addPath(
  prev: Readonly<Path> | undefined,
  key: string | number,
  typename: string | undefined,
): Path {
  const fieldDepth = prev
    ? typeof key === 'number'
      ? prev.fieldDepth
      : prev.fieldDepth + 1
    : 1;
  return { prev, key, typename, fieldDepth };
}

/**
 * Given a Path, return an Array of the path keys.
 */
export function pathToArray(
  path: Maybe<Readonly<Path>>,
): Array<string | number> {
  const flattened = [];
  let curr = path;
  while (curr) {
    flattened.push(curr.key);
    curr = curr.prev;
  }
  return flattened.reverse();
}

export function pathAtFieldDepth(
  path: Path | undefined,
  fieldDepth: number,
): Path | undefined {
  if (fieldDepth === 0) {
    return undefined;
  }
  let currentPath = path;
  while (currentPath !== undefined) {
    if (currentPath.fieldDepth === fieldDepth) {
      return currentPath;
    }
    currentPath = currentPath.prev;
  }
  /* c8 ignore next 5 */
  throw new Error(
    `Path is of fieldDepth ${
      path === undefined ? 0 : path.fieldDepth
    }, but fieldDepth ${fieldDepth} requested.`,
  );
}
