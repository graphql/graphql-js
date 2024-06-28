export function isNumeric(value: unknown): value is number | bigint {
  const valueTypeOf = typeof value;
  if (valueTypeOf === 'number') {
    return Number.isFinite(value);
  }
  return valueTypeOf === 'bigint';
}
