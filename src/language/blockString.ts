import { isWhiteSpace } from './characterClasses';

/**
 * Produces the value of a block string from its parsed raw value, similar to
 * CoffeeScript's block string, Python's docstring trim or Ruby's strip_heredoc.
 *
 * This implements the GraphQL spec's BlockStringValue() static algorithm.
 *
 * @internal
 */
export function dedentBlockStringValue(rawString: string): string {
  // Expand a block string's raw value into independent lines.
  const lines = rawString.split(/\r\n|[\n\r]/g);

  // Remove common indentation from all lines but first.
  const commonIndent = getBlockStringIndentation(rawString);

  if (commonIndent !== 0) {
    for (let i = 1; i < lines.length; i++) {
      lines[i] = lines[i].slice(commonIndent);
    }
  }

  // Remove leading and trailing blank lines.
  let startLine = 0;
  while (startLine < lines.length && isBlank(lines[startLine])) {
    ++startLine;
  }

  let endLine = lines.length;
  while (endLine > startLine && isBlank(lines[endLine - 1])) {
    --endLine;
  }

  // Return a string of the lines joined with U+000A.
  return lines.slice(startLine, endLine).join('\n');
}

function isBlank(str: string): boolean {
  for (const char of str) {
    if (char !== ' ' && char !== '\t') {
      return false;
    }
  }

  return true;
}

function getBlockStringIndentation(value: string): number {
  let isFirstLine = true;
  let isEmptyLine = true;
  let indent = 0;
  let commonIndent = null;

  for (let i = 0; i < value.length; ++i) {
    switch (value.charCodeAt(i)) {
      case 13: //  \r
        if (value.charCodeAt(i + 1) === 10) {
          ++i; // skip \r\n as one symbol
        }
      // falls through
      case 10: //  \n
        isFirstLine = false;
        isEmptyLine = true;
        indent = 0;
        break;
      case 9: //   \t
      case 32: //  <space>
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

  return commonIndent ?? 0;
}

/**
 * Print a block string in the indented block form by adding a leading and
 * trailing blank line. However, if a block string starts with whitespace and is
 * a single-line, adding a leading blank line would strip that whitespace.
 *
 * `preferMultipleLines` has following semantics:
 *    * `true` - add leading and trailing new lines if possible
 *    * `false` - don't add leading and trailing new lines if possible
 *    * `undefined` - add leading and trailing new lines only if it improves readability
 *
 * @internal
 */
export function printBlockString(
  value: string,
  preferMultipleLines?: boolean,
): string {
  const escapedValue = value.replace(/"""/g, '\\"""');

  const isSingleLine = !value.includes('\n');

  // If common identation is found we can fix some of those cases by adding leading new line
  const forceLeadingNewLine = getBlockStringIndentation(value) > 0;

  // Trailing triple quotes just looks confusing but doesn't force trailing new line
  const hasTrailingTripleQuotes = escapedValue.endsWith('\\"""');

  // Trailing quote (single or double) or slash forces trailing new line
  const hasTrailingQuote = value.endsWith('"') && !hasTrailingTripleQuotes;
  const hasTrailingSlash = value.endsWith('\\');
  const forceTrailingNewline = hasTrailingQuote || hasTrailingSlash;

  const printAsMultipleLines =
    preferMultipleLines ??
    // add leading and trailing new lines only if it improves readability
    (!isSingleLine ||
      forceTrailingNewline ||
      forceLeadingNewLine ||
      hasTrailingTripleQuotes);

  let result = '';

  // Format a multi-line block quote to account for leading space.
  const skipLeadingNewLine = isSingleLine && isWhiteSpace(value.charCodeAt(0));
  if ((printAsMultipleLines && !skipLeadingNewLine) || forceLeadingNewLine) {
    result += '\n';
  }

  result += escapedValue;
  if (printAsMultipleLines || forceTrailingNewline) {
    result += '\n';
  }

  return '"""' + result + '"""';
}
