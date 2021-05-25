/**
 * Returns true if the value acts like a Promise, i.e. has a "then" function,
 * otherwise returns false.
 */
export function isPromise(value) {
  // eslint-disable-next-line @typescript-eslint/dot-notation
  return (
    typeof (value === null || value === void 0 ? void 0 : value['then']) ===
    'function'
  );
}