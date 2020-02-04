// @flow strict

// FIXME:
// flowlint uninitialized-instance-property:off

import isObjectLike from '../jsutils/isObjectLike';
import { SYMBOL_TO_STRING_TAG } from '../polyfills/symbols';

import { type ASTNode } from '../language/ast';
import { type Source } from '../language/source';
import { type SourceLocation, getLocation } from '../language/location';
import { printLocation, printSourceLocation } from '../language/printLocation';

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
  +locations: $ReadOnlyArray<SourceLocation> | void;

  /**
   * An array describing the JSON-path into the execution response which
   * corresponds to this error. Only included for errors during execution.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
  +path: $ReadOnlyArray<string | number> | void;

  /**
   * An array of GraphQL AST Nodes corresponding to this error.
   */
  +nodes: $ReadOnlyArray<ASTNode> | void;

  /**
   * The source GraphQL document for the first location of this error.
   *
   * Note that if this Error represents more than one node, the source may not
   * represent nodes after the first node.
   */
  +source: Source | void;

  /**
   * An array of character offsets within the source GraphQL document
   * which correspond to this error.
   */
  +positions: $ReadOnlyArray<number> | void;

  /**
   * The original error thrown from a field resolver during execution.
   */
  +originalError: ?Error;

  /**
   * Extension fields to add to the formatted error.
   */
  +extensions: { [key: string]: mixed, ... } | void;

  constructor(
    message: string,
    nodes?: $ReadOnlyArray<ASTNode> | ASTNode | void | null,
    source?: ?Source,
    positions?: ?$ReadOnlyArray<number>,
    path?: ?$ReadOnlyArray<string | number>,
    originalError?: ?(Error & { +extensions?: mixed, ... }),
    extensions?: ?{ [key: string]: mixed, ... },
  ): void {
    super(message);

    // Compute list of blame nodes.
    const _nodes = Array.isArray(nodes)
      ? nodes.length !== 0
        ? nodes
        : undefined
      : nodes
      ? [nodes]
      : undefined;

    // Compute locations in the source for the given nodes/positions.
    let _source = source;
    if (!_source && _nodes) {
      _source = _nodes[0].loc?.source;
    }

    let _positions = positions;
    if (!_positions && _nodes) {
      _positions = _nodes.reduce((list, node) => {
        if (node.loc) {
          list.push(node.loc.start);
        }
        return list;
      }, []);
    }
    if (_positions && _positions.length === 0) {
      _positions = undefined;
    }

    let _locations;
    if (positions && source) {
      _locations = positions.map(pos => getLocation(source, pos));
    } else if (_nodes) {
      _locations = _nodes.reduce((list, node) => {
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

    Object.defineProperties((this: any), {
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
      },
      source: {
        value: _source ?? undefined,
      },
      positions: {
        value: _positions ?? undefined,
      },
      originalError: {
        value: originalError,
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

    /* istanbul ignore next (See: https://github.com/graphql/graphql-js/issues/2317) */
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GraphQLError);
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
  // $FlowFixMe Flow doesn't support computed properties yet
  get [SYMBOL_TO_STRING_TAG](): string {
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
