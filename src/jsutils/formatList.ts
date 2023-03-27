import { invariant } from './invariant.js';

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
  const firstItem = items[0];
  invariant(firstItem !== undefined);

  switch (items.length) {
    case 1:
      return firstItem;
    case 2:
      return firstItem + ' ' + conjunction + ' ' + items[1];
  }

  const allButLast = items.slice(0, -1);
  const lastItem = items.at(-1);
  return allButLast.join(', ') + ', ' + conjunction + ' ' + lastItem;
}
