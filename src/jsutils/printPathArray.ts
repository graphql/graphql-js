/**
 * Build a string describing the path.
 */
export function printPathArray(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return '';
  }
  return ` at ${path
    .map((key) => (typeof key === 'number' ? `[${key}]` : `.${key}`))
    .join('')}`;
}
