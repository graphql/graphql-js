/** @category Source */

import { devAssert } from '../jsutils/devAssert.ts';
import { instanceOf } from '../jsutils/instanceOf.ts';

interface Location {
  line: number;
  column: number;
}

const sourceSymbol: unique symbol = Symbol('Source');

/**
 * A representation of source input to GraphQL. The `name` and `locationOffset` parameters are
 * optional, but they are useful for clients who store GraphQL documents in source files.
 * For example, if the GraphQL input starts at line 40 in a file named `Foo.graphql`, it might
 * be useful for `name` to be `"Foo.graphql"` and location to be `{ line: 40, column: 1 }`.
 * The `line` and `column` properties in `locationOffset` are 1-indexed.
 */
export class Source {
  /** Internal runtime marker used to identify Source instances. */
  readonly __kind: symbol;

  /** The GraphQL source text. */
  body: string;
  /** Name used in diagnostics for this source, such as a file path or request name. */
  name: string;
  /** One-indexed line and column where this source begins. */
  locationOffset: Location;

  /**
   * Creates a Source instance.
   * @param body - The GraphQL source text.
   * @param name - Name used in diagnostics for this source.
   * @param locationOffset - One-indexed line and column where this source begins.
   * @example
   * ```ts
   * import { Source } from 'graphql/language';
   *
   * const source = new Source(
   *   'type Query { greeting: String }',
   *   'schema.graphql',
   *   { line: 10, column: 1 },
   * );
   *
   * source.body; // => 'type Query { greeting: String }'
   * source.name; // => 'schema.graphql'
   * source.locationOffset; // => { line: 10, column: 1 }
   * ```
   */
  constructor(
    body: string,
    name: string = 'GraphQL request',
    locationOffset: Location = { line: 1, column: 1 },
  ) {
    this.__kind = sourceSymbol;
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

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
    return 'Source';
  }
}

/**
 * Test if the given value is a Source object.
 *
 * @internal
 */
export function isSource(source: unknown): source is Source {
  return instanceOf(source, sourceSymbol, Source);
}
