import defineToJSON from '../jsutils/defineToJSON';

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
