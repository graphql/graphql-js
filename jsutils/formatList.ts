import { invariant } from './invariant.ts';
/**
 * Given [ A, B, C ] return 'A, B, or C'.
 */
export function orList(items: ReadonlyArray<string>): string {
  return formatList('or', items);
}
/**
 * Given [ A, B, C ] return 'A, B, and C'.
 */
export function andList(items: ReadonlyArray<string>): string {
  return formatList('and', items);
}
function formatList(conjunction: string, items: ReadonlyArray<string>): string {
  items.length !== 0 || invariant(false);
  switch (items.length) {
    case 1:
      return items[0];
    case 2:
      return items[0] + ' ' + conjunction + ' ' + items[1];
  }
  const allButLast = items.slice(0, -1);
  const lastItem = items[items.length - 1];
  return allButLast.join(', ') + ', ' + conjunction + ' ' + lastItem;
}
