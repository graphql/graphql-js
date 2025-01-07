import { invariant } from '../jsutils/invariant.js';
import { isObjectLike } from '../jsutils/isObjectLike.js';
import type { ObjMap } from '../jsutils/ObjMap.js';

export function getObjectAtPath(
  data: ObjMap<unknown>,
  path: ReadonlyArray<string | number>,
): ObjMap<unknown> | Array<unknown> {
  if (path.length === 0) {
    return data;
  }

  let current: unknown = data[path[0]];
  for (let i = 1; i < path.length; i++) {
    const key = path[i];
    if (Array.isArray(current)) {
      invariant(typeof key === 'number');
      current = current[key];
      continue;
    } else if (isObjectLike(current)) {
      invariant(typeof key === 'string');
      current = current[key];
      continue;
    }
    invariant(false);
  }

  invariant(isObjectLike(current) || Array.isArray(current));

  return current;
}
