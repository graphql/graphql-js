/**
 * Special inspect function to produce readable string literal for error messages in tests
 */
export default function inspectStr(str: ?string): string {
  if (str == null) {
    return 'null';
  }
  return JSON.stringify(str)
    .replace(/^"|"$/g, '`')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}
