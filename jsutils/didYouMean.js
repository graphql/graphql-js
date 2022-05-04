const MAX_SUGGESTIONS = 5;
export function didYouMean(firstArg, secondArg) {
  const [subMessage, suggestionsArg] = secondArg
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
