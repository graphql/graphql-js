import { devAssert } from '../jsutils/devAssert.ts';
import { instanceOf } from '../jsutils/instanceOf.ts';
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
  constructor(
    body: string,
    name: string = 'GraphQL request',
    locationOffset: Location = { line: 1, column: 1 },
  ) {
    this.body = body;
    this.name = name;
    this.locationOffset = locationOffset;
    this.locationOffset.line > 0 ||
      devAssert(
        false,
        'line in locationOffset is 1-indexed and must be positive.',
      );
    this.locationOffset.column > 0 ||
      devAssert(
        false,
        'column in locationOffset is 1-indexed and must be positive.',
      );
  }
  get [Symbol.toStringTag]() {
    return 'Source';
  }
}
/**
 * Test if the given value is a Source object.
 *
 * @internal
 */
export function isSource(source: unknown): source is Source {
  return instanceOf(source, Source);
}
