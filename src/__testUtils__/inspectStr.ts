import type { Maybe } from '../jsutils/Maybe.js';

/**
 * Special inspect function to produce readable string literal for error messages in tests
 */
export function inspectStr(str: Maybe<string>): string {
  if (str == null) {
    return 'null';
  }
  return JSON.stringify(str)
    .replace(/^"|"$/g, '`')
    .replaceAll('\\"', '"')
    .replaceAll('\\\\', '\\');
}
