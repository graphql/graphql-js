import { isWhiteSpace } from './characterClasses';

/**
 * Produces the value of a block string from its parsed raw value, similar to
 * CoffeeScript's block string, Python's docstring trim or Ruby's strip_heredoc.
 *
 * This implements the GraphQL spec's BlockStringValue() static algorithm.
 *
 * @internal
 */
export function dedentBlockStringLines(
  lines: ReadonlyArray<string>,
): Array<string> {
  let commonIndent = Number.MAX_SAFE_INTEGER;
  let firstNonEmptyLine = null;
  let lastNonEmptyLine = -1;

  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i];
    const indent = leadingWhitespace(line);

    if (indent === line.length) {
      continue; // skip empty lines
    }

    firstNonEmptyLine = firstNonEmptyLine ?? i;
    lastNonEmptyLine = i;

    if (i !== 0 && indent < commonIndent) {
      commonIndent = indent;
    }
  }

  return (
    lines
      // Remove common indentation from all lines but first.
      .map((line, i) => (i === 0 ? line : line.slice(commonIndent)))
      // Remove leading and trailing blank lines.
      .slice(firstNonEmptyLine ?? 0, lastNonEmptyLine + 1)
  );
}

function leadingWhitespace(str: string): number {
  let i = 0;
  while (i < str.length && isWhiteSpace(str.charCodeAt(i))) {
    ++i;
  }
  return i;
}

/**
 * @internal
 */
export function isPrintableAsBlockString(value: string): boolean {
  if (value === '') {
    return true; // empty string is printable
  }

  let isEmptyLine = true;
  let hasIndent = false;
  let hasCommonIndent = true;
  let seenNonEmptyLine = false;

  for (let i = 0; i < value.length; ++i) {
    switch (value.codePointAt(i)) {
      case 0x0000:
      case 0x0001:
      case 0x0002:
      case 0x0003:
      case 0x0004:
      case 0x0005:
      case 0x0006:
      case 0x0007:
      case 0x0008:
      case 0x000b:
      case 0x000c:
      case 0x000e:
      case 0x000f:
        return false; // Has non-printable characters

      case 0x000d: //  \r
        return false; // Has \r or \r\n which will be replaced as \n

      case 10: //  \n
        if (isEmptyLine && !seenNonEmptyLine) {
          return false; // Has leading new line
        }
        seenNonEmptyLine = true;

        isEmptyLine = true;
        hasIndent = false;
        break;
      case 9: //   \t
      case 32: //  <space>
        hasIndent ||= isEmptyLine;
        break;
      default:
        hasCommonIndent &&= hasIndent;
        isEmptyLine = false;
    }
  }

  if (isEmptyLine) {
    return false; // Has trailing empty lines
  }

  if (hasCommonIndent && seenNonEmptyLine) {
    return false; // Has internal indent
  }

  return true;
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
  options?: { minimize?: boolean },
): string {
  const escapedValue = value.replace(/"""/g, '\\"""');

  // Expand a block string's raw value into independent lines.
  const lines = escapedValue.split(/\r\n|[\n\r]/g);
  const isSingleLine = lines.length === 1;

  // If common indentation is found we can fix some of those cases by adding leading new line
  const forceLeadingNewLine =
    lines.length > 1 &&
    lines
      .slice(1)
      .every((line) => line.length === 0 || isWhiteSpace(line.charCodeAt(0)));

  // Trailing triple quotes just looks confusing but doesn't force trailing new line
  const hasTrailingTripleQuotes = escapedValue.endsWith('\\"""');

  // Trailing quote (single or double) or slash forces trailing new line
  const hasTrailingQuote = value.endsWith('"') && !hasTrailingTripleQuotes;
  const hasTrailingSlash = value.endsWith('\\');
  const forceTrailingNewline = hasTrailingQuote || hasTrailingSlash;

  const printAsMultipleLines =
    !options?.minimize &&
    // add leading and trailing new lines only if it improves readability
    (!isSingleLine ||
      value.length > 70 ||
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
