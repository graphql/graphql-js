import type { ObjMap } from '../jsutils/ObjMap';

declare function objectValues<T>(obj: ObjMap<T>): Array<T>;

/* eslint-disable no-redeclare */
// $FlowFixMe[name-already-bound] workaround for: https://github.com/facebook/flow/issues/4441
export const objectValues =
  Object.values || ((obj) => Object.keys(obj).map((key) => obj[key]));
