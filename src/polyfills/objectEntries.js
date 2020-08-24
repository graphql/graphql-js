import type { ObjMap } from '../jsutils/ObjMap';

declare function objectEntries<T>(obj: ObjMap<T>): Array<[string, T]>;

/* eslint-disable no-redeclare */
// $FlowFixMe[name-already-bound] workaround for: https://github.com/facebook/flow/issues/4441
const objectEntries =
  Object.entries || ((obj) => Object.keys(obj).map((key) => [key, obj[key]]));

export default objectEntries;
