// @flow strict
/**
 * Returns a number indicating whether a reference string comes before, or after,
 * or is the same as the given string in natural sort order.
 *
 * See: https://en.wikipedia.org/wiki/Natural_sort_order
 *
 */
export default function naturalCompare(aStr: string, bStr: string): number {
  let aIdx = 0;
  let bIdx = 0;

  while (aIdx < aStr.length && bIdx < bStr.length) {
    let aChar = aStr.charCodeAt(aIdx);
    let bChar = bStr.charCodeAt(bIdx);

    if (isDigit(aChar) && isDigit(bChar)) {
      let aNum = 0;
      do {
        ++aIdx;
        aNum = aNum * 10 + aChar - DIGIT_0;
        aChar = aStr.charCodeAt(aIdx);
      } while (isDigit(aChar) && aNum > 0);

      let bNum = 0;
      do {
        ++bIdx;
        bNum = bNum * 10 + bChar - DIGIT_0;
        bChar = bStr.charCodeAt(bIdx);
      } while (isDigit(bChar) && bNum > 0);

      if (aNum < bNum) {
        return -1;
      }

      if (aNum > bNum) {
        return 1;
      }
    } else {
      if (aChar < bChar) {
        return -1;
      }
      if (aChar > bChar) {
        return 1;
      }
      ++aIdx;
      ++bIdx;
    }
  }

  return aStr.length - bStr.length;
}

const DIGIT_0 = 48;
const DIGIT_9 = 57;

function isDigit(code: number): boolean {
  return !isNaN(code) && DIGIT_0 <= code && code <= DIGIT_9;
}
