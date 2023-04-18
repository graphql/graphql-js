import type { Maybe } from './Maybe.js';

export interface Path<T = undefined> {
  readonly prev: Path<T> | undefined;
  readonly key: string | number;
  readonly info: T;
}

/**
 * Given a Path and a key, return a new Path containing the new key.
 */
export function addPath<T>(
  prev: Readonly<Path<T>> | undefined,
  key: string | number,
  info: T,
): Path<T> {
  return { prev, key, info };
}

/**
 * Given a Path, return an Array of the path keys.
 */
export function pathToArray(
  path: Maybe<Readonly<Path<unknown>>>,
): Array<string | number> {
  const flattened = [];
  let curr = path;
  while (curr) {
    flattened.push(curr.key);
    curr = curr.prev;
  }
  return flattened.reverse();
}
