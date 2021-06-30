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
 * ```ts
 * const str = dedent`
 *   {
 *     test
 *   }
 * `;
 * str === "{\n  test\n}";
 * ```
 */
export function dedent(
  strings: ReadonlyArray<string>,
  ...values: ReadonlyArray<string>
): string {
  let str = strings[0];

  for (let i = 1; i < strings.length; ++i) {
    str += values[i - 1] + strings[i]; // interpolation
  }
  return dedentString(str);
}
