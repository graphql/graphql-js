import { orList } from './formatList.ts';
const MAX_SUGGESTIONS = 5;
/**
 * Given [ A, B, C ] return ' Did you mean A, B, or C?'.
 */
export function didYouMean(suggestions: ReadonlyArray<string>): string;
export function didYouMean(
  subMessage: string,
  suggestions: ReadonlyArray<string>,
): string;
export function didYouMean(
  firstArg: string | ReadonlyArray<string>,
  secondArg?: ReadonlyArray<string>,
) {
  const [subMessage, suggestions] = secondArg
    ? [firstArg as string, secondArg]
    : [undefined, firstArg as ReadonlyArray<string>];
  if (suggestions.length === 0) {
    return '';
  }
  let message = ' Did you mean ';
  if (subMessage) {
    message += subMessage + ' ';
  }
  const suggestionList = orList(
    suggestions.slice(0, MAX_SUGGESTIONS).map((x) => `"${x}"`),
  );
  return message + suggestionList + '?';
}
