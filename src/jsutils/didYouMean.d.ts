/**
 * Given [ A, B, C ] return ' Did you mean A, B, or C?'.
 */
declare function didYouMean(suggestions: ReadonlyArray<string>): string;
declare function didYouMean(
  subMessage: string,
  suggestions: ReadonlyArray<string>,
): string;

export default didYouMean;
