export function isFunction<T>(value: unknown): value is T & Function {
  return typeof value === 'function';
}
