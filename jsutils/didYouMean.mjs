import { orList } from './formatList.mjs';
const MAX_SUGGESTIONS = 5;
export function didYouMean(firstArg, secondArg) {
  const [subMessage, suggestions] = secondArg
    ? [firstArg, secondArg]
    : [undefined, firstArg];
  if (suggestions.length === 0) {
    return '';
  }
  let message = ' Did you mean ';
  if (subMessage != null) {
    message += subMessage + ' ';
  }
  const suggestionList = orList(
    suggestions.slice(0, MAX_SUGGESTIONS).map((x) => `"${x}"`),
  );
  return message + suggestionList + '?';
}
