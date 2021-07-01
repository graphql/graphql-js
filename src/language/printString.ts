/**
 * Prints a string as a GraphQL StringValue literal. Replaces control characters
 * and excluded characters (" U+0022 and \\ U+005C) with escape sequences.
 */
export function printString(str: string): string {
  return `"${str.replace(escapedRegExp, escapedReplacer)}"`;
}

// eslint-disable-next-line no-control-regex
const escapedRegExp = /[\x00-\x1f\x22\x5c\x7f-\x9f]/g;

function escapedReplacer(str: string): string {
  return escapeSequences[str.charCodeAt(0)];
}

// prettier-ignore
const escapeSequences = [
  '\\u0000', '\\u0001', '\\u0002', '\\u0003', '\\u0004', '\\u0005', '\\u0006', '\\u0007',
  '\\b',     '\\t',     '\\n',     '\\u000B', '\\f',     '\\r',     '\\u000E', '\\u000F',
  '\\u0010', '\\u0011', '\\u0012', '\\u0013', '\\u0014', '\\u0015', '\\u0016', '\\u0017',
  '\\u0018', '\\u0019', '\\u001A', '\\u001B', '\\u001C', '\\u001D', '\\u001E', '\\u001F',
  '',        '',        '\\"',     '',        '',        '',        '',        '',
  '',        '',        '',        '',        '',        '',        '',        '', // 2F
  '',        '',        '',        '',        '',        '',        '',        '',
  '',        '',        '',        '',        '',        '',        '',        '', // 3F
  '',        '',        '',        '',        '',        '',        '',        '',
  '',        '',        '',        '',        '',        '',        '',        '', // 4F
  '',        '',        '',        '',        '',        '',        '',        '',
  '',        '',        '',        '',        '\\\\',    '',        '',        '', // 5F
  '',        '',        '',        '',        '',        '',        '',        '',
  '',        '',        '',        '',        '',        '',        '',        '', // 6F
  '',        '',        '',        '',        '',        '',        '',        '',
  '',        '',        '',        '',        '',        '',        '',        '\\u007F',
  '\\u0080', '\\u0081', '\\u0082', '\\u0083', '\\u0084', '\\u0085', '\\u0086', '\\u0087',
  '\\u0088', '\\u0089', '\\u008A', '\\u008B', '\\u008C', '\\u008D', '\\u008E', '\\u008F',
  '\\u0090', '\\u0091', '\\u0092', '\\u0093', '\\u0094', '\\u0095', '\\u0096', '\\u0097',
  '\\u0098', '\\u0099', '\\u009A', '\\u009B', '\\u009C', '\\u009D', '\\u009E', '\\u009F',
];
