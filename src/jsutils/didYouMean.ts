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
): string {
  const [subMessage, suggestionsArg] =
    typeof firstArg === 'string'
      ? [firstArg, secondArg]
      : [undefined, firstArg];

  let message = ' Did you mean ';
  if (subMessage) {
    message += subMessage + ' ';
  }

  const suggestions = suggestionsArg.map((x) => `"${x}"`);
  switch (suggestions.length) {
    case 0:
      return '';
    case 1:
      return message + suggestions[0] + '?';
    case 2:
      return message + suggestions[0] + ' or ' + suggestions[1] + '?';
  }

  const selected = suggestions.slice(0, MAX_SUGGESTIONS);
  const lastItem = selected.pop();
  return message + selected.join(', ') + ', or ' + lastItem + '?';
}
