'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.GraphQLError = void 0;
const isObjectLike_js_1 = require('../jsutils/isObjectLike.js');
const location_js_1 = require('../language/location.js');
const printLocation_js_1 = require('../language/printLocation.js');
/**
 * A GraphQLError describes an Error found during the parse, validate, or
 * execute phases of performing a GraphQL operation. In addition to a message
 * and stack trace, it also includes information about the locations in a
 * GraphQL document and/or execution result that correspond to the Error.
 */
class GraphQLError extends Error {
  constructor(message, options = {}) {
    const { nodes, source, positions, path, originalError, extensions } =
      options;
    super(message);
    this.name = 'GraphQLError';
    this.path = path ?? undefined;
    this.originalError = originalError ?? undefined;
    // Compute list of blame nodes.
    this.nodes = undefinedIfEmpty(
      Array.isArray(nodes) ? nodes : nodes ? [nodes] : undefined,
    );
    const nodeLocations = undefinedIfEmpty(
      this.nodes?.map((node) => node.loc).filter((loc) => loc != null),
    );
    // Compute locations in the source for the given nodes/positions.
    this.source = source ?? nodeLocations?.[0]?.source;
    this.positions = positions ?? nodeLocations?.map((loc) => loc.start);
    this.locations =
      positions && source
        ? positions.map((pos) => (0, location_js_1.getLocation)(source, pos))
        : nodeLocations?.map((loc) =>
            (0, location_js_1.getLocation)(loc.source, loc.start),
          );
    const originalExtensions = (0, isObjectLike_js_1.isObjectLike)(
      originalError?.extensions,
    )
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
    if (originalError?.stack != null) {
      Object.defineProperty(this, 'stack', {
        value: originalError.stack,
        writable: true,
        configurable: true,
      });
    } else if (Error.captureStackTrace != null) {
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
  get [Symbol.toStringTag]() {
    return 'GraphQLError';
  }
  toString() {
    let output = this.message;
    if (this.nodes) {
      for (const node of this.nodes) {
        if (node.loc) {
          output += '\n\n' + (0, printLocation_js_1.printLocation)(node.loc);
        }
      }
    } else if (this.source && this.locations) {
      for (const location of this.locations) {
        output +=
          '\n\n' +
          (0, printLocation_js_1.printSourceLocation)(this.source, location);
      }
    }
    return output;
  }
  toJSON() {
    const formattedError = {
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
exports.GraphQLError = GraphQLError;
function undefinedIfEmpty(array) {
  return array === undefined || array.length === 0 ? undefined : array;
}
