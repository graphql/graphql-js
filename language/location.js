'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getLocation = void 0;
const invariant_js_1 = require('../jsutils/invariant.js');
const LineRegExp = /\r\n|[\n\r]/g;
/**
 * Takes a Source and a UTF-8 character offset, and returns the corresponding
 * line and column as a SourceLocation.
 */
function getLocation(source, position) {
  let lastLineStart = 0;
  let line = 1;
  for (const match of source.body.matchAll(LineRegExp)) {
    typeof match.index === 'number' || (0, invariant_js_1.invariant)(false);
    if (match.index >= position) {
      break;
    }
    lastLineStart = match.index + match[0].length;
    line += 1;
  }
  return { line, column: position + 1 - lastLineStart };
}
exports.getLocation = getLocation;
