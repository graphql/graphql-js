import inspect from '../jsutils/inspect';
import devAssert from '../jsutils/devAssert';
import instanceOf from '../jsutils/instanceOf';

type Location = {|
  line: number,
  column: number,
|};

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
    devAssert(
      typeof body === 'string',
      `Body must be a string. Received: ${inspect(body)}.`,
    );

    this.body = body;
    this.name = name;
    this.locationOffset = locationOffset;
    devAssert(
      this.locationOffset.line > 0,
      'line in locationOffset is 1-indexed and must be positive.',
    );
    devAssert(
      this.locationOffset.column > 0,
      'column in locationOffset is 1-indexed and must be positive.',
    );
  }

  // $FlowFixMe[unsupported-syntax] Flow doesn't support computed properties yet
  get [Symbol.toStringTag]() {
    return 'Source';
  }
}

/**
 * Test if the given value is a Source object.
 *
 * @internal
 */
declare function isSource(source: mixed): boolean %checks(source instanceof
  Source);
// eslint-disable-next-line no-redeclare
export function isSource(source) {
  return instanceOf(source, Source);
}
