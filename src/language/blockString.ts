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
