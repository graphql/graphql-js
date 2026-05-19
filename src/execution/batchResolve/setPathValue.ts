import { invariant } from '../../jsutils/invariant.ts';
import type { ObjMap } from '../../jsutils/ObjMap.ts';
import type { Path } from '../../jsutils/Path.ts';

/**
 * Batch resolvers write successful field values through the queued field
 * entry's response target. This helper is only used for error handling, where
 * nulls may bubble.
 * @internal
 */
export function setPathValue(
  data: unknown,
  rootPath: Path | undefined,
  path: Path,
  value: unknown,
): boolean {
  // Incremental payloads use rootPath to treat one payload or item as a root.
  const pathKeys: Array<string | number> = [];
  for (
    let currentPath: Path | undefined = path;
    currentPath !== rootPath;
    currentPath = currentPath.prev
  ) {
    if (currentPath === undefined) {
      return false;
    }
    pathKeys.push(currentPath.key);
  }

  if (pathKeys.length === 0) {
    return false;
  }

  let parent: unknown = data;
  for (let i = pathKeys.length - 1; i > 0; --i) {
    parent = (parent as { [key: string | number]: unknown } | undefined)?.[
      pathKeys[i]
    ];
  }

  if (isResponseObject(parent)) {
    const key = pathKeys[0];
    invariant(key !== undefined, 'Missing response path key.');
    (parent as { [key: string | number]: unknown })[key] = value;
    return true;
  }
  return false;
}

function isResponseObject(
  value: unknown,
): value is ObjMap<unknown> | Array<unknown> {
  return (
    Array.isArray(value) ||
    (typeof value === 'object' &&
      value !== null &&
      Object.getPrototypeOf(value) === null)
  );
}
