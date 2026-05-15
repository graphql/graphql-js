/** @category Errors */

import { isObjectLike } from '../jsutils/isObjectLike';
import type { Maybe } from '../jsutils/Maybe';

import type { ASTNode, Location } from '../language/ast';
import type { SourceLocation } from '../language/location';
import { getLocation } from '../language/location';
import { printLocation, printSourceLocation } from '../language/printLocation';
import type { Source } from '../language/source';

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
  nodes?: ReadonlyArray<ASTNode> | ASTNode | null;
  /** Source document used to derive error locations. */
  source?: Maybe<Source>;
  /** Character offsets in the source document associated with this error. */
  positions?: Maybe<ReadonlyArray<number>>;
  /** Response path where this error occurred during execution. */
  path?: Maybe<ReadonlyArray<string | number>>;
  /** Original error that caused this GraphQLError, if one exists. */
  originalError?: Maybe<
    Error & {
      /** Extension fields associated with this value. */
      readonly extensions?: unknown;
    }
  >;
  /** Extension fields to include in the formatted result. */
  extensions?: Maybe<GraphQLErrorExtensions>;
}

type BackwardsCompatibleArgs =
  | [options?: GraphQLErrorOptions]
  | [
      nodes?: GraphQLErrorOptions['nodes'],
      source?: GraphQLErrorOptions['source'],
      positions?: GraphQLErrorOptions['positions'],
      path?: GraphQLErrorOptions['path'],
      originalError?: GraphQLErrorOptions['originalError'],
      extensions?: GraphQLErrorOptions['extensions'],
    ];

function toNormalizedOptions(
  args: BackwardsCompatibleArgs,
): GraphQLErrorOptions {
  const firstArg = args[0];
  if (firstArg == null || 'kind' in firstArg || 'length' in firstArg) {
    return {
      nodes: firstArg,
      source: args[1],
      positions: args[2],
      path: args[3],
      originalError: args[4],
      extensions: args[5],
    };
  }
  return firstArg;
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

  /** Original error that caused this GraphQLError, if one exists. */
  readonly originalError: Error | undefined;

  /** Extension fields to add to the formatted error. */
  readonly extensions: GraphQLErrorExtensions;

  /**
   * Creates a GraphQLError instance.
   * @param message - Human-readable error message.
   * @param options - Error metadata such as source locations, response path, original error, and extensions.
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
   * // This variant derives locations from source positions and preserves the original error.
   * import { Source } from 'graphql/language';
   * import { GraphQLError } from 'graphql/error';
   *
   * const source = new Source('{ greeting }');
   * const originalError = new Error('Database unavailable.');
   * const error = new GraphQLError('Resolver failed.', {
   *   source,
   *   positions: [2],
   *   path: ['greeting'],
   *   originalError,
   * });
   *
   * error.locations; // => [{ line: 1, column: 3 }]
   * error.path; // => ['greeting']
   * error.originalError; // => originalError
   * ```
   */
  constructor(message: string, options?: GraphQLErrorOptions);
  /**
   * Creates a GraphQLError instance using the legacy positional constructor.
   * Prefer the `GraphQLErrorOptions` object overload, which keeps optional error
   * metadata in a single options bag.
   * @param message - Human-readable error message.
   * @param nodes - AST node or nodes associated with this error.
   * @param source - Source document used to derive error locations.
   * @param positions - Character offsets in the source document associated with
   * this error.
   * @param path - Response path where this error occurred during execution.
   * @param originalError - Original error that caused this GraphQLError, if one
   * exists.
   * @param extensions - Extension fields to include in the formatted error.
   * @example
   * ```ts
   * import { Source } from 'graphql/language';
   * import { GraphQLError } from 'graphql/error';
   *
   * const source = new Source('{ greeting }');
   * const originalError = new Error('Database unavailable.');
   * const error = new GraphQLError(
   *   'Resolver failed.',
   *   undefined,
   *   source,
   *   [2],
   *   ['greeting'],
   *   originalError,
   *   { code: 'INTERNAL' },
   * );
   *
   * error.locations; // => [{ line: 1, column: 3 }]
   * error.path; // => ['greeting']
   * error.originalError; // => originalError
   * error.extensions; // => { code: 'INTERNAL' }
   * ```
   * @deprecated Please use the `GraphQLErrorOptions` constructor overload instead.
   */
  constructor(
    message: string,
    nodes?: ReadonlyArray<ASTNode> | ASTNode | null,
    source?: Maybe<Source>,
    positions?: Maybe<ReadonlyArray<number>>,
    path?: Maybe<ReadonlyArray<string | number>>,
    originalError?: Maybe<Error & { readonly extensions?: unknown }>,
    extensions?: Maybe<GraphQLErrorExtensions>,
  );
  constructor(message: string, ...rawArgs: BackwardsCompatibleArgs) {
    const { nodes, source, positions, path, originalError, extensions } =
      toNormalizedOptions(rawArgs);
    super(message);

    this.name = 'GraphQLError';
    this.path = path ?? undefined;
    this.originalError = originalError ?? undefined;

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

    const originalExtensions = isObjectLike(originalError?.extensions)
      ? originalError?.extensions
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
    /* c8 ignore start */
    // FIXME: https://github.com/graphql/graphql-js/issues/2317
    if (originalError?.stack) {
      Object.defineProperty(this, 'stack', {
        value: originalError.stack,
        writable: true,
        configurable: true,
      });
    } else if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GraphQLError);
    } else {
      Object.defineProperty(this, 'stack', {
        value: Error().stack,
        writable: true,
        configurable: true,
      });
    }
    /* c8 ignore stop */
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
  toString(): string {
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

/**
 * Prints a GraphQLError to a string, representing useful location information
 * about the error's position in the source. This helper is retained for
 * backwards compatibility; call `error.toString()` instead because printError
 * will be removed in v17.
 * @param error - The error to format.
 * @returns The printed string representation.
 * @example
 * ```ts
 * import { GraphQLError, printError } from 'graphql/error';
 *
 * const message = printError(new GraphQLError('Example error'));
 *
 * message; // => 'Example error'
 * ```
 * @deprecated Please use `error.toString` instead. Will be removed in v17
 */
export function printError(error: GraphQLError): string {
  return error.toString();
}

/**
 * Given a GraphQLError, format it according to the rules described by the
 * Response Format, Errors section of the GraphQL Specification. This helper is
 * retained for backwards compatibility; call `error.toJSON()` instead because
 * formatError will be removed in v17.
 * @param error - The error to format.
 * @returns The JSON-serializable formatted error.
 * @example
 * ```ts
 * import { GraphQLError, formatError } from 'graphql/error';
 *
 * const formatted = formatError(new GraphQLError('Example error'));
 *
 * formatted; // => { message: 'Example error' }
 * ```
 * @deprecated Please use `error.toJSON` instead. Will be removed in v17
 */
export function formatError(error: GraphQLError): GraphQLFormattedError {
  return error.toJSON();
}
