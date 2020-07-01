import { SYMBOL_TO_STRING_TAG } from "../polyfills/symbols.js";
import devAssert from "../jsutils/devAssert.js";

/**
 * A representation of source input to GraphQL. The `name` and `locationOffset` parameters are
 * optional, but they are useful for clients who store GraphQL documents in source files.
 * For example, if the GraphQL input starts at line 40 in a file named `Foo.graphql`, it might
 * be useful for `name` to be `"Foo.graphql"` and location to be `{ line: 40, column: 1 }`.
 * The `line` and `column` properties in `locationOffset` are 1-indexed.
 */
export class Source {
  constructor(body, name = 'GraphQL request', locationOffset = {
    line: 1,
    column: 1
  }) {
    this.body = body;
    this.name = name;
    this.locationOffset = locationOffset;
    this.locationOffset.line > 0 || devAssert(0, 'line in locationOffset is 1-indexed and must be positive.');
    this.locationOffset.column > 0 || devAssert(0, 'column in locationOffset is 1-indexed and must be positive.');
  } // $FlowFixMe Flow doesn't support computed properties yet


  get [SYMBOL_TO_STRING_TAG]() {
    return 'Source';
  }

}
