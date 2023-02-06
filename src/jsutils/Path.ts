/**
 * @internal
 */
export class Root {
  readonly _subPaths: Map<string | number, Path>;

  constructor() {
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
 * @internal
 */
export class Path {
  readonly prev: Path | Root;
  readonly key: string | number;
  readonly typename: string | undefined;

  readonly _subPaths: Map<string | number, Path>;

  constructor(
    prev: Path | Root,
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
  path: Readonly<Path | Root>,
): Array<string | number> {
  const flattened = [];
  let curr = path;
  while (curr instanceof Path) {
    flattened.push(curr.key);
    curr = curr.prev;
  }
  return flattened.reverse();
}
