export function isArray<T>(
  value: T | Array<T> | ReadonlyArray<T>,
): value is Array<T> | ReadonlyArray<T> {
  return Array.isArray(value);
}
