export function dedentString(string: string): string {
  const trimmedStr = string
    .replace(/^\n*/m, '') //  remove leading newline
    .replace(/[ \t\n]*$/, ''); // remove trailing spaces and tabs

  // fixes indentation by removing leading spaces and tabs from each line
  let indent = '';
  for (const char of trimmedStr) {
    if (char !== ' ' && char !== '\t') {
      break;
    }
    indent += char;
  }

  return trimmedStr.replace(RegExp('^' + indent, 'mg'), ''); // remove indent
}

/**
 * An ES6 string tag that fixes indentation and also trims string.
 *
 * Example usage:
 * const str = dedent`
 *   {
 *     test
 *   }
 * `;
 * str === "{\n  test\n}";
 */
export function dedent(
  strings: $ReadOnlyArray<string>,
  ...values: $ReadOnlyArray<string>
): string {
  let str = '';

  for (let i = 0; i < strings.length; ++i) {
    str += strings[i];
    if (i < values.length) {
      // istanbul ignore next (Ignore else inside Babel generated code)
      const value = values[i];

      str += value; // interpolation
    }
  }

  return dedentString(str);
}
