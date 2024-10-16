export function isInteger(value: unknown): value is number | bigint {
  const valueTypeOf = typeof value;
  if (valueTypeOf === 'number') {
    return Number.isInteger(value);
  }
  return valueTypeOf === 'bigint';
}
