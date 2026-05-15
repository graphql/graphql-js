/**
 * Build a string describing the path.
 *
 * @internal
 */
export function printPathArray(path: ReadonlyArray<string | number>): string {
  return path
    .map((key) =>
      typeof key === 'number' ? '[' + key.toString() + ']' : '.' + key,
    )
    .join('');
}
