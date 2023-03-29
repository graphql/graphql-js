import { invariant } from './invariant.mjs';
/**
 * Given [ A, B, C ] return 'A, B, or C'.
 */
export function orList(items) {
  return formatList('or', items);
}
/**
 * Given [ A, B, C ] return 'A, B, and C'.
 */
export function andList(items) {
  return formatList('and', items);
}
function formatList(conjunction, items) {
  items.length !== 0 || invariant(false);
  switch (items.length) {
    case 1:
      return items[0];
    case 2:
      return items[0] + ' ' + conjunction + ' ' + items[1];
  }
  const allButLast = items.slice(0, -1);
  const lastItem = items.at(-1);
  return allButLast.join(', ') + ', ' + conjunction + ' ' + lastItem;
}
