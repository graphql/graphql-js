'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.dedentBlockStringValue = dedentBlockStringValue;
exports.getBlockStringIndentation = getBlockStringIndentation;
exports.printBlockString = printBlockString;

/**
 * Produces the value of a block string from its parsed raw value, similar to
 * CoffeeScript's block string, Python's docstring trim or Ruby's strip_heredoc.
 *
 * This implements the GraphQL spec's BlockStringValue() static algorithm.
 *
 * @internal
 */
function dedentBlockStringValue(rawString) {
  // Expand a block string's raw value into independent lines.
  const lines = rawString.split(/\r\n|[\n\r]/g); // Remove common indentation from all lines but first.

  const commonIndent = getBlockStringIndentation(rawString);

  if (commonIndent !== 0) {
    for (let i = 1; i < lines.length; i++) {
      lines[i] = lines[i].slice(commonIndent);
    }
  } // Remove leading and trailing blank lines.

  let startLine = 0;

  while (startLine < lines.length && isBlank(lines[startLine])) {
    ++startLine;
  }

  let endLine = lines.length;

  while (endLine > startLine && isBlank(lines[endLine - 1])) {
    --endLine;
  } // Return a string of the lines joined with U+000A.

  return lines.slice(startLine, endLine).join('\n');
}

function isBlank(str) {
  for (const char of str) {
    if (char !== ' ' && char !== '\t') {
      return false;
    }
  }

  return true;
}
/**
 * @internal
 */

function getBlockStringIndentation(value) {
  var _commonIndent;

  let isFirstLine = true;
  let isEmptyLine = true;
  let indent = 0;
  let commonIndent = null;

  for (let i = 0; i < value.length; ++i) {
    switch (value.charCodeAt(i)) {
      case 13:
        //  \r
        if (value.charCodeAt(i + 1) === 10) {
          ++i; // skip \r\n as one symbol
        }

      // falls through

      case 10:
        //  \n
        isFirstLine = false;
        isEmptyLine = true;
        indent = 0;
        break;

      case 9: //   \t

      case 32:
        //  <space>
        ++indent;
        break;

      default:
        if (
          isEmptyLine &&
          !isFirstLine &&
          (commonIndent === null || indent < commonIndent)
        ) {
          commonIndent = indent;
        }

        isEmptyLine = false;
    }
  }

  return (_commonIndent = commonIndent) !== null && _commonIndent !== void 0
    ? _commonIndent
    : 0;
}
/**
 * Print a block string in the indented block form by adding a leading and
 * trailing blank line. However, if a block string starts with whitespace and is
 * a single-line, adding a leading blank line would strip that whitespace.
 *
 * @internal
 */

function printBlockString(value, preferMultipleLines = false) {
  const isSingleLine = !value.includes('\n');
  const hasLeadingSpace = value.startsWith(' ') || value.startsWith('\t');
  const hasTrailingQuote = value.endsWith('"');
  const hasTrailingSlash = value.endsWith('\\');
  const printAsMultipleLines =
    !isSingleLine ||
    hasTrailingQuote ||
    hasTrailingSlash ||
    preferMultipleLines;
  let result = ''; // Format a multi-line block quote to account for leading space.

  if (printAsMultipleLines && !(isSingleLine && hasLeadingSpace)) {
    result += '\n';
  }

  result += value;

  if (printAsMultipleLines) {
    result += '\n';
  }

  return '"""' + result.replace(/"""/g, '\\"""') + '"""';
}
