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
  for (let i = 0; i < str.length; ++i) {
    if (str[i] !== ' ' && str[i] !== '\t') {
      return false;
    }
  }

  return true;
}

/**
 * @internal
 */
export function getBlockStringIndentation(value: string): number {
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
 * @internal
 */
export function printBlockString(
  value: string,
  indentation: string = '',
  preferMultipleLines: boolean = false,
): string {
  const isSingleLine = value.indexOf('\n') === -1;
  const hasLeadingSpace = value[0] === ' ' || value[0] === '\t';
  const hasTrailingQuote = value[value.length - 1] === '"';
  const hasTrailingSlash = value[value.length - 1] === '\\';
  const printAsMultipleLines =
    !isSingleLine ||
    hasTrailingQuote ||
    hasTrailingSlash ||
    preferMultipleLines;

  let result = '';
  // Format a multi-line block quote to account for leading space.
  if (printAsMultipleLines && !(isSingleLine && hasLeadingSpace)) {
    result += '\n' + indentation;
  }
  result += indentation ? value.replace(/\n/g, '\n' + indentation) : value;
  if (printAsMultipleLines) {
    result += '\n';
  }

  return '"""' + result.replace(/"""/g, '\\"""') + '"""';
}
