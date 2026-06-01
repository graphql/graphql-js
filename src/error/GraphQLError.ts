/** @category Errors */

import { isObjectLike } from '../jsutils/isObjectLike.ts';
import type { Maybe } from '../jsutils/Maybe.ts';

import type { ASTNode, Location } from '../language/ast.ts';
import type { SourceLocation } from '../language/location.ts';
import { getLocation } from '../language/location.ts';
import {
  printLocation,
  printSourceLocation,
} from '../language/printLocation.ts';
import type { Source } from '../language/source.ts';

/**
 * Custom extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLErrorExtensions {
  [attributeName: string]: unknown;
}

/**
 * Custom formatted extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLFormattedErrorExtensions {
  [attributeName: string]: unknown;
}

/** Options used to construct a GraphQLError. */
export interface GraphQLErrorOptions {
  /** AST node or nodes associated with this error. */
  nodes?: ReadonlyArray<ASTNode> | ASTNode | null | undefined;
  /** Source document used to derive error locations. */
  source?: Maybe<Source>;
  /** Character offsets in the source document associated with this error. */
  positions?: Maybe<ReadonlyArray<number>>;
  /** Response path where this error occurred during execution. */
  path?: Maybe<ReadonlyArray<string | number>>;
  /**
   * Original error that caused this GraphQLError, if one exists.
   * @deprecated Prefer `cause` instead.
   */
  originalError?: Maybe<Error & { readonly extensions?: unknown }>;
  /** Cause of this GraphQLError, if one exists. */
  cause?: unknown;
  /** Extension fields to include in the formatted result. */
  extensions?: Maybe<GraphQLErrorExtensions>;
}

/**
 * A GraphQLError describes an Error found during the parse, validate, or
 * execute phases of performing a GraphQL operation. In addition to a message
 * and stack trace, it also includes information about the locations in a
 * GraphQL document and/or execution result that correspond to the Error.
 */
export class GraphQLError extends Error {
  /**
   * An array of `{ line, column }` locations within the source GraphQL document
   * which correspond to this error.
   *
   * Errors during validation often contain multiple locations, for example to
   * point out two things with the same name. Errors during execution include a
   * single location, the field which produced the error.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
  readonly locations: ReadonlyArray<SourceLocation> | undefined;

  /**
   * An array describing the JSON-path into the execution response which
   * corresponds to this error. Only included for errors during execution.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
  readonly path: ReadonlyArray<string | number> | undefined;

  /** An array of GraphQL AST Nodes corresponding to this error. */
  readonly nodes: ReadonlyArray<ASTNode> | undefined;

  /**
   * The source GraphQL document for the first location of this error.
   *
   * Note that if this Error represents more than one node, the source may not
   * represent nodes after the first node.
   */
  readonly source: Source | undefined;

  /**
   * An array of character offsets within the source GraphQL document
   * which correspond to this error.
   */
  readonly positions: ReadonlyArray<number> | undefined;

  /**
   * The original error thrown from a field resolver during execution.
   * @deprecated Use `cause` instead.
   */
  readonly originalError: Error | undefined;

  /** Extension fields to add to the formatted error. */
  readonly extensions: GraphQLErrorExtensions;

  /**
   * Creates a GraphQLError instance.
   * @param message - Human-readable error message.
   * @param options - Error metadata such as source locations, response path, cause, original error, and extensions.
   * @example
   * ```ts
   * // Create an error from AST nodes and response metadata.
   * import { parse } from 'graphql/language';
   * import { GraphQLError } from 'graphql/error';
   *
   * const document = parse('{ greeting }');
   * const fieldNode = document.definitions[0].selectionSet.selections[0];
   * const error = new GraphQLError('Cannot query this field.', {
   *   nodes: fieldNode,
   *   path: ['greeting'],
   *   extensions: { code: 'FORBIDDEN' },
   * });
   *
   * error.message; // => 'Cannot query this field.'
   * error.locations; // => [{ line: 1, column: 3 }]
   * error.path; // => ['greeting']
   * error.extensions; // => { code: 'FORBIDDEN' }
   * ```
   * @example
   * ```ts
   * // This variant derives locations from source positions and preserves the cause.
   * import { Source } from 'graphql/language';
   * import { GraphQLError } from 'graphql/error';
   *
   * const source = new Source('{ greeting }');
   * const cause = new Error('Database unavailable.');
   * const error = new GraphQLError('Resolver failed.', {
   *   source,
   *   positions: [2],
   *   path: ['greeting'],
   *   cause,
   * });
   *
   * error.locations; // => [{ line: 1, column: 3 }]
   * error.path; // => ['greeting']
   * error.cause; // => cause
   * ```
   */
  constructor(message: string, options: GraphQLErrorOptions = {}) {
    const { nodes, source, positions, path, originalError, cause, extensions } =
      options;

    const hasCause = 'cause' in options;
    const errorCause = hasCause ? cause : originalError;
    const errorOptions =
      hasCause || originalError != null ? { cause: errorCause } : undefined;
    super(message, errorOptions);

    this.name = 'GraphQLError';
    this.path = path ?? undefined;
    const underlyingError:
      | (Error & { readonly extensions?: unknown })
      | undefined =
      originalError ?? (errorCause instanceof Error ? errorCause : undefined);
    this.originalError = underlyingError;

    // Compute list of blame nodes.
    this.nodes = undefinedIfEmpty(
      Array.isArray(nodes) ? nodes : nodes ? [nodes] : undefined,
    );

    const nodeLocations = undefinedIfEmpty(
      this.nodes
        ?.map((node) => node.loc)
        .filter((loc): loc is Location => loc != null),
    );

    // Compute locations in the source for the given nodes/positions.
    this.source = source ?? nodeLocations?.[0]?.source;

    this.positions = positions ?? nodeLocations?.map((loc) => loc.start);

    this.locations =
      positions && source
        ? positions.map((pos) => getLocation(source, pos))
        : nodeLocations?.map((loc) => getLocation(loc.source, loc.start));

    const originalExtensions = isObjectLike(underlyingError?.extensions)
      ? underlyingError.extensions
      : undefined;
    this.extensions = extensions ?? originalExtensions ?? Object.create(null);

    // Only properties prescribed by the spec should be enumerable.
    // Keep the rest as non-enumerable.
    Object.defineProperties(this, {
      message: {
        writable: true,
        enumerable: true,
      },
      name: { enumerable: false },
      nodes: { enumerable: false },
      source: { enumerable: false },
      positions: { enumerable: false },
      originalError: { enumerable: false },
    });

    // Include (non-enumerable) stack trace.
    if (underlyingError?.stack != null) {
      Object.defineProperty(this, 'stack', {
        value: underlyingError.stack,
        writable: true,
        configurable: true,
      });
    } else if (Error.captureStackTrace != null) {
      Error.captureStackTrace(this, GraphQLError);
      // See: https://github.com/graphql/graphql-js/issues/2317
      /* node:coverage ignore next 7 */
    } else {
      Object.defineProperty(this, 'stack', {
        value: Error().stack,
        writable: true,
        configurable: true,
      });
    }
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
    return 'GraphQLError';
  }

  /**
   * Returns this error as a human-readable message with source locations.
   * @returns The formatted error string.
   * @example
   * ```ts
   * import { Source } from 'graphql/language';
   * import { GraphQLError } from 'graphql/error';
   *
   * const error = new GraphQLError('Cannot query field "name".', {
   *   source: new Source('{ name }'),
   *   positions: [2],
   * });
   *
   * error.toString(); // => 'Cannot query field "name".\n\nGraphQL request:1:3\n1 | { name }\n  |   ^'
   * ```
   */
  override toString(): string {
    let output = this.message;

    if (this.nodes) {
      for (const node of this.nodes) {
        if (node.loc) {
          output += '\n\n' + printLocation(node.loc);
        }
      }
    } else if (this.source && this.locations) {
      for (const location of this.locations) {
        output += '\n\n' + printSourceLocation(this.source, location);
      }
    }

    return output;
  }

  /**
   * Returns the JSON representation used when this object is serialized.
   * @returns The JSON-serializable representation.
   * @example
   * ```ts
   * import { GraphQLError } from 'graphql/error';
   *
   * const error = new GraphQLError('Resolver failed.', {
   *   path: ['viewer', 'name'],
   *   extensions: { code: 'INTERNAL' },
   * });
   *
   * error.toJSON(); // => { message: 'Resolver failed.', path: ['viewer', 'name'], extensions: { code: 'INTERNAL' } }
   * ```
   */
  toJSON(): GraphQLFormattedError {
    type WritableFormattedError = {
      -readonly [P in keyof GraphQLFormattedError]: GraphQLFormattedError[P];
    };

    const formattedError: WritableFormattedError = {
      message: this.message,
    };

    if (this.locations != null) {
      formattedError.locations = this.locations;
    }

    if (this.path != null) {
      formattedError.path = this.path;
    }

    if (this.extensions != null && Object.keys(this.extensions).length > 0) {
      formattedError.extensions = this.extensions;
    }

    return formattedError;
  }
}

function undefinedIfEmpty<T>(
  array: Array<T> | undefined,
): Array<T> | undefined {
  return array === undefined || array.length === 0 ? undefined : array;
}

/** See: https://spec.graphql.org/draft/#sec-Errors */
export interface GraphQLFormattedError {
  /**
   * A short, human-readable summary of the problem that **SHOULD NOT** change
   * from occurrence to occurrence of the problem, except for purposes of
   * localization.
   */
  readonly message: string;
  /**
   * If an error can be associated to a particular point in the requested
   * GraphQL document, it should contain a list of locations.
   */
  readonly locations?: ReadonlyArray<SourceLocation>;
  /**
   * If an error can be associated to a particular field in the GraphQL result,
   * it _must_ contain an entry with the key `path` that details the path of
   * the response field which experienced the error. This allows clients to
   * identify whether a null result is intentional or caused by a runtime error.
   */
  readonly path?: ReadonlyArray<string | number>;
  /**
   * Reserved for implementors to extend the protocol however they see fit,
   * and hence there are no additional restrictions on its contents.
   */
  readonly extensions?: GraphQLFormattedErrorExtensions;
}
