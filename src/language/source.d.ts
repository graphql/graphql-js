interface Location {
  line: number;
  column: number;
}

/**
 * A representation of source input to GraphQL. The `name` and `locationOffset` parameters are
 * optional, but they are useful for clients who store GraphQL documents in source files.
 * For example, if the GraphQL input starts at line 40 in a file named `Foo.graphql`, it might
 * be useful for `name` to be `"Foo.graphql"` and location to be `{ line: 40, column: 1 }`.
 * The `line` and `column` properties in `locationOffset` are 1-indexed.
 */
export class Source {
  body: string;
  name: string;
  locationOffset: Location;
  constructor(body: string, name?: string, locationOffset?: Location);
}

/**
 * Test if the given value is a Source object.
 *
 * @internal
 */
export function isSource(source: any): source is Source;
