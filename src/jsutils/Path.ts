import type { Maybe } from './Maybe.js';

/**
 * @internal
 */
export class Path {
  readonly prev: Path | undefined;
  readonly key: string | number;
  readonly typename: string | undefined;

  readonly _subPaths: Map<string | number, Path>;

  constructor(
    prev: Path | undefined,
    key: string | number,
    typename: string | undefined,
  ) {
    this.prev = prev;
    this.key = key;
    this.typename = typename;
    this._subPaths = new Map();
  }

  /**
   * Given a Path and a key, return a new Path containing the new key.
   */
  addPath(key: string | number, typeName: string | undefined): Path {
    let path = this._subPaths.get(key);
    if (path !== undefined) {
      return path;
    }

    path = new Path(this, key, typeName);
    this._subPaths.set(key, path);
    return path;
  }
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

export type PathFactory = (
  path: Path | undefined,
  key: string | number,
  typeName: string | undefined,
) => Path;

export function createPathFactory(): PathFactory {
  const paths = new Map<string, Path>();
  return (path, key, typeName) => {
    if (path !== undefined) {
      return path.addPath(key, typeName);
    }

    let newPath = paths.get(key as string);
    if (newPath !== undefined) {
      return newPath;
    }

    newPath = new Path(undefined, key, typeName);
    paths.set(key as string, newPath);
    return newPath;
  };
}
