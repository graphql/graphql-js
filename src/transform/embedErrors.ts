import { invariant } from '../jsutils/invariant.js';
import { isObjectLike } from '../jsutils/isObjectLike.js';
import type { ObjMap } from '../jsutils/ObjMap.js';

import type { GraphQLError } from '../error/GraphQLError.js';

export function embedErrors(
  data: ObjMap<unknown> | null,
  errors: ReadonlyArray<GraphQLError> | undefined,
): Array<GraphQLError> {
  if (errors == null || errors.length === 0) {
    return [];
  }
  const errorsWithoutValidPath: Array<GraphQLError> = [];
  for (const error of errors) {
    if (!error.path || error.path.length === 0) {
      errorsWithoutValidPath.push(error);
      continue;
    }
    embedErrorByPath(
      error,
      error.path,
      error.path[0],
      1,
      data,
      errorsWithoutValidPath,
    );
  }
  return errorsWithoutValidPath;
}

// eslint-disable-next-line @typescript-eslint/max-params
function embedErrorByPath(
  error: GraphQLError,
  path: ReadonlyArray<string | number>,
  currentKey: string | number,
  nextIndex: number,
  parent: unknown,
  errorsWithoutValidPath: Array<GraphQLError>,
): void {
  if (nextIndex === path.length) {
    if (Array.isArray(parent)) {
      if (typeof currentKey !== 'number') {
        errorsWithoutValidPath.push(error);
        return;
      }
      invariant(
        maybeEmbed(
          parent as unknown as ObjMap<unknown>,
          currentKey as unknown as string,
          error,
        ) instanceof AggregateError,
      );
      return;
    }
    if (isObjectLike(parent)) {
      if (typeof currentKey !== 'string') {
        errorsWithoutValidPath.push(error);
        return;
      }
      invariant(
        maybeEmbed(parent, currentKey, error) instanceof AggregateError,
      );
      return;
    }
    errorsWithoutValidPath.push(error);
    return;
  }

  let next: unknown;
  if (Array.isArray(parent)) {
    if (typeof currentKey !== 'number') {
      errorsWithoutValidPath.push(error);
      return;
    }
    next = maybeEmbed(
      parent as unknown as ObjMap<unknown>,
      currentKey as unknown as string,
      error,
    );
    if (next instanceof AggregateError) {
      return;
    }
  } else if (isObjectLike(parent)) {
    if (typeof currentKey !== 'string') {
      errorsWithoutValidPath.push(error);
      return;
    }
    next = maybeEmbed(parent, currentKey, error);
    if (next instanceof AggregateError) {
      return;
    }
  } else {
    errorsWithoutValidPath.push(error);
    return;
  }

  embedErrorByPath(
    error,
    path,
    path[nextIndex],
    nextIndex + 1,
    next,
    errorsWithoutValidPath,
  );
}

function maybeEmbed(
  parent: ObjMap<unknown>,
  key: string,
  error: GraphQLError,
): unknown {
  let next = parent[key];
  if (next == null) {
    next = parent[key] = new AggregateError([error]);
  } else if (next instanceof AggregateError) {
    next.errors.push(error);
  }
  return next;
}
