'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.pathToArray = exports.addPath = void 0;
/**
 * Given a Path and a key, return a new Path containing the new key.
 */
function addPath(prev, key, typename) {
  return { prev, key, typename };
}
exports.addPath = addPath;
/**
 * Given a Path, return an Array of the path keys.
 */
function pathToArray(path) {
  const flattened = [];
  let curr = path;
  while (curr) {
    flattened.push(curr.key);
    curr = curr.prev;
  }
  return flattened.reverse();
}
exports.pathToArray = pathToArray;
