import isObjectLike from '../jsutils/isObjectLike';
import { SYMBOL_TO_STRING_TAG } from '../polyfills/symbols';

import type { ASTNode } from '../language/ast';
import type { Source } from '../language/source';
import type { SourceLocation } from '../language/location';
import { getLocation } from '../language/location';
import { printLocation, printSourceLocation } from '../language/printLocation';
import { formatError } from './formatError';
import type { GraphQLFormattedError } from './formatError';

/**
 * A GraphQLError describes an Error found during the parse, validate, or
 * execute phases of performing a GraphQL operation. In addition to a message
 * and stack trace, it also includes information about the locations in a
 * GraphQL document and/or execution result that correspond to the Error.
 */
export class GraphQLError extends Error {
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
  +originalError: Error | void | null;

  /**
   * Extension fields to add to the formatted error.
   */
  +extensions: { [key: string]: mixed, ... };

  constructor(
    message: string,
    nodes?: $ReadOnlyArray<ASTNode> | ASTNode | void | null,
    source?: ?Source,
    positions?: ?$ReadOnlyArray<number>,
    path?: ?$ReadOnlyArray<string | number>,
    originalError?: ?(Error & { +extensions?: mixed, ... }),
    extensions?: ?{ [key: string]: mixed, ... },
  ) {
    super(message);

    this.name = 'GraphQLError';
    this.originalError = originalError ?? undefined;

    // Compute list of blame nodes.
    this.nodes = undefinedIfEmpty(
      Array.isArray(nodes) ? nodes : nodes ? [nodes] : undefined,
    );

    let nodeLocations = [];
    for (const { loc } of this.nodes ?? []) {
      if (loc != null) {
        nodeLocations.push(loc);
      }
    }
    nodeLocations = undefinedIfEmpty(nodeLocations);

    // Compute locations in the source for the given nodes/positions.
    this.source = source ?? nodeLocations?.[0].source;

    this.positions = positions ?? nodeLocations?.map((loc) => loc.start);

    this.locations =
      positions && source
        ? positions.map((pos) => getLocation(source, pos))
        : nodeLocations?.map((loc) => getLocation(loc.source, loc.start));

    this.path = path ?? undefined;

    const originalExtensions = originalError?.extensions;

    if (extensions == null && isObjectLike(originalExtensions)) {
      this.extensions = { ...originalExtensions };
    } else {
      this.extensions = extensions ?? {};
    }

    // By being enumerable, JSON.stringify will include bellow properties in the resulting output.
    // This ensures that the simplest possible GraphQL service adheres to the spec.
    Object.defineProperties((this: any), {
      message: { enumerable: true },
      locations: {
        enumerable: this.locations != null,
      },
      path: {
        enumerable: this.path != null,
      },
      extensions: {
        enumerable:
          this.extensions != null && Object.keys(this.extensions).length > 0,
      },
      name: { enumerable: false },
      nodes: { enumerable: false },
      source: { enumerable: false },
      positions: { enumerable: false },
      originalError: { enumerable: false },
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

  toJSON(): GraphQLFormattedError {
    return formatError(this);
  }

  // FIXME: workaround to not break chai comparisons, should be remove in v16
  // $FlowFixMe[unsupported-syntax] Flow doesn't support computed properties yet
  get [SYMBOL_TO_STRING_TAG](): string {
    return 'Object';
  }
}

function undefinedIfEmpty<T>(
  array: $ReadOnlyArray<T> | void,
): $ReadOnlyArray<T> | void {
  return array === undefined || array.length === 0 ? undefined : array;
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
