import defineToJSON from "../jsutils/defineToJSON.mjs";

/**
 * Contains a range of UTF-8 character offsets and token references that
 * identify the region of the source from which the AST derived.
 */
export var Location =
/**
 * The character offset at which this Node begins.
 */

/**
 * The character offset at which this Node ends.
 */

/**
 * The Token at which this Node begins.
 */

/**
 * The Token at which this Node ends.
 */

/**
 * The Source document the AST represents.
 */
function Location(startToken, endToken, source) {
  this.start = startToken.start;
  this.end = endToken.end;
  this.startToken = startToken;
  this.endToken = endToken;
  this.source = source;
}; // Print a simplified form when appearing in JSON/util.inspect.

defineToJSON(Location, function () {
  return {
    start: this.start,
    end: this.end
  };
});
/**
 * Represents a range of characters represented by a lexical token
 * within a Source.
 */

export var Token =
/**
 * The kind of Token.
 */

/**
 * The character offset at which this Node begins.
 */

/**
 * The character offset at which this Node ends.
 */

/**
 * The 1-indexed line number on which this Token appears.
 */

/**
 * The 1-indexed column number at which this Token begins.
 */

/**
 * For non-punctuation tokens, represents the interpreted value of the token.
 */

/**
 * Tokens exist as nodes in a double-linked-list amongst all tokens
 * including ignored tokens. <SOF> is always the first node and <EOF>
 * the last.
 */
function Token(kind, start, end, line, column, prev, value) {
  this.kind = kind;
  this.start = start;
  this.end = end;
  this.line = line;
  this.column = column;
  this.value = value;
  this.prev = prev;
  this.next = null;
}; // Print a simplified form when appearing in JSON/util.inspect.

defineToJSON(Token, function () {
  return {
    kind: this.kind,
    value: this.value,
    line: this.line,
    column: this.column
  };
});
/**
 * @internal
 */

export function isNode(maybeNode) {
  return maybeNode != null && typeof maybeNode.kind === 'string';
}
/**
 * The list of all possible AST node types.
 */
