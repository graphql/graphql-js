import { isObjectLike } from '../jsutils/isObjectLike';

import type { ASTNode } from '../language/ast';
import type { Source } from '../language/source';
import type { SourceLocation } from '../language/location';
import { getLocation } from '../language/location';
import { printLocation, printSourceLocation } from '../language/printLocation';
import type { Maybe } from '../jsutils/Maybe';

/**
 * A GraphQLError describes an Error found during the parse, validate, or
 * execute phases of performing a GraphQL operation. In addition to a message
 * and stack trace, it also includes information about the locations in a
 * GraphQL document and/or execution result that correspond to the Error.
 */
export class GraphQLError extends Error {
  /**
   * A message describing the Error for debugging purposes.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   *
   * Note: should be treated as readonly, despite invariant usage.
   */
  message: string;

  /**
   * An array of { line, column } locations within the source GraphQL document
   * which correspond to this error.
   *
   * Errors during validation often contain multiple locations, for example to
   * point out two things with the same name. Errors during execution include a
   * single location, the field which produced the error.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
  readonly locations: ReadonlyArray<SourceLocation> | undefined | null;

  /**
   * An array describing the JSON-path into the execution response which
   * corresponds to this error. Only included for errors during execution.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
  readonly path: ReadonlyArray<string | number> | undefined | null;

  /**
   * An array of GraphQL AST Nodes corresponding to this error.
   */
  readonly nodes: ReadonlyArray<ASTNode> | undefined | null;

  /**
   * The source GraphQL document for the first location of this error.
   *
   * Note that if this Error represents more than one node, the source may not
   * represent nodes after the first node.
   */
  readonly source: Source | undefined | null;

  /**
   * An array of character offsets within the source GraphQL document
   * which correspond to this error.
   */
  readonly positions: ReadonlyArray<number> | undefined | null;

  /**
   * The original error thrown from a field resolver during execution.
   */
  readonly originalError: Maybe<Error>;

  /**
   * Extension fields to add to the formatted error.
   */
  readonly extensions: Record<string, unknown> | undefined | null;

  constructor(
    message: string,
    nodes?: ReadonlyArray<ASTNode> | ASTNode | undefined | null,
    source?: Maybe<Source>,
    positions?: Maybe<ReadonlyArray<number>>,
    path?: Maybe<ReadonlyArray<string | number>>,
    originalError?: Maybe<Error & { readonly extensions?: unknown }>,
    extensions?: Maybe<Record<string, unknown>>,
  ) {
    super(message);

    // Compute list of blame nodes.
    const _nodes = ensureArray(nodes);

    // Compute locations in the source for the given nodes/positions.
    let _source = source;
    if (!_source && _nodes) {
      _source = _nodes[0].loc?.source;
    }

    let _positions = positions;
    if (!_positions && _nodes) {
      _positions = _nodes.reduce<Array<number>>((list, node) => {
        if (node.loc) {
          list.push(node.loc.start);
        }
        return list;
      }, []);
    }
    if (_positions && _positions.length === 0) {
      _positions = undefined;
    }

    let _locations: Array<SourceLocation>;
    if (positions && source) {
      _locations = positions.map((pos) => getLocation(source, pos));
    } else if (_nodes) {
      _locations = _nodes.reduce<Array<SourceLocation>>((list, node) => {
        if (node.loc) {
          list.push(getLocation(node.loc.source, node.loc.start));
        }
        return list;
      }, []);
    }

    let _extensions = extensions;
    if (_extensions == null && originalError != null) {
      const originalExtensions = originalError.extensions;
      if (isObjectLike(originalExtensions)) {
        _extensions = originalExtensions;
      }
    }

    Object.defineProperties(this as any, {
      name: { value: 'GraphQLError' },
      message: {
        value: message,
        // By being enumerable, JSON.stringify will include `message` in the
        // resulting output. This ensures that the simplest possible GraphQL
        // service adheres to the spec.
        enumerable: true,
        writable: true,
      },
      locations: {
        // Coercing falsy values to undefined ensures they will not be included
        // in JSON.stringify() when not provided.
        value: _locations ?? undefined,
        // By being enumerable, JSON.stringify will include `locations` in the
        // resulting output. This ensures that the simplest possible GraphQL
        // service adheres to the spec.
        enumerable: _locations != null,
      },
      path: {
        // Coercing falsy values to undefined ensures they will not be included
        // in JSON.stringify() when not provided.
        value: path ?? undefined,
        // By being enumerable, JSON.stringify will include `path` in the
        // resulting output. This ensures that the simplest possible GraphQL
        // service adheres to the spec.
        enumerable: path != null,
      },
      nodes: {
        value: _nodes ?? undefined,
        enumerable: false,
      },
      source: {
        value: _source ?? undefined,
        enumerable: false,
      },
      positions: {
        value: _positions ?? undefined,
        enumerable: false,
      },
      originalError: {
        value: originalError,
        enumerable: false,
      },
      extensions: {
        // Coercing falsy values to undefined ensures they will not be included
        // in JSON.stringify() when not provided.
        value: _extensions ?? undefined,
        // By being enumerable, JSON.stringify will include `path` in the
        // resulting output. This ensures that the simplest possible GraphQL
        // service adheres to the spec.
        enumerable: _extensions != null,
      },
    });

    // Include (non-enumerable) stack trace.
    if (originalError?.stack) {
      Object.defineProperty(this, 'stack', {
        value: originalError.stack,
        writable: true,
        configurable: true,
      });
      return;
    }

    // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2317')
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, GraphQLError);
    } else {
      Object.defineProperty(this, 'stack', {
        value: Error().stack,
        writable: true,
        configurable: true,
      });
    }
  }

  toString(): string {
    return printError(this);
  }

  // FIXME: workaround to not break chai comparisons, should be remove in v16
  get [Symbol.toStringTag](): string {
    return 'Object';
  }
}

/**
 * Prints a GraphQLError to a string, representing useful location information
 * about the error's position in the source.
 */
export function printError(error: GraphQLError): string {
  let output = error.message;

  if (error.nodes) {
    for (const node of error.nodes) {
      if (node.loc) {
        output += '\n\n' + printLocation(node.loc);
      }
    }
  } else if (error.source && error.locations) {
    for (const location of error.locations) {
      output += '\n\n' + printSourceLocation(error.source, location);
    }
  }

  return output;
}

function ensureArray<T>(
  nodes: T | ReadonlyArray<T> | undefined | null,
): ReadonlyArray<T> | undefined {
  return Array.isArray(nodes)
    ? nodes.length !== 0
      ? nodes
      : undefined
    : nodes
    ? ([nodes] as ReadonlyArray<T>)
    : undefined;
}
