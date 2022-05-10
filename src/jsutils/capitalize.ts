/**
 * Converts the first character of string to upper case and the remaining to lower case.
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
