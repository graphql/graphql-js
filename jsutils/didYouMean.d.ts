/**
 * Given [ A, B, C ] return ' Did you mean A, B, or C?'.
 */
export function didYouMean(suggestions: ReadonlyArray<string>): string;
export function didYouMean(
  subMessage: string,
  suggestions: ReadonlyArray<string>,
): string;
