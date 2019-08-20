// @flow strict

declare function flatMap<T, U>(
  list: $ReadOnlyArray<T>,
  fn: (item: T, index: number) => $ReadOnlyArray<U> | U,
): Array<U>;

/* eslint-disable no-redeclare */
// $FlowFixMe
const flatMap = Array.prototype.flatMap
  ? function(list, fn) {
      return Array.prototype.flatMap.call(list, fn);
    }
  : function(list, fn) {
      let result = [];
      for (const item of list) {
        const value = fn(item);
        if (Array.isArray(value)) {
          result = result.concat(value);
        } else {
          result.push(value);
        }
      }
      return result;
    };
export default flatMap;
