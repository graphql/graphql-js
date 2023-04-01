'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.didYouMean = void 0;
const formatList_js_1 = require('./formatList.js');
const MAX_SUGGESTIONS = 5;
function didYouMean(firstArg, secondArg) {
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
  const suggestionList = (0, formatList_js_1.orList)(
    suggestions.slice(0, MAX_SUGGESTIONS).map((x) => `"${x}"`),
  );
  return message + suggestionList + '?';
}
exports.didYouMean = didYouMean;
