/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { getLocation } from '../language';
import type { ASTNode } from '../language/ast';
import type { Source } from '../language/source';

/**
 * A GraphQLError describes an Error found during the parse, validate, or
 * execute phases of performing a GraphQL operation. In addition to a message
 * and stack trace, it also includes information about the locations in a
 * GraphQL document and/or execution result that correspond to the Error.
 */
declare class GraphQLError extends Error {

  /**
   * A message describing the Error for debugging purposes.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
  message: string,

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
  locations: Array<{ line: number, column: number }> | void;

  /**
   * An array describing the JSON-path into the execution response which
   * corresponds to this error. Only included for errors during execution.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
  path: Array<string | number> | void;

  /**
   * An array of GraphQL AST Nodes corresponding to this error.
   */
  nodes: Array<ASTNode> | void;

  /**
   * The source GraphQL document corresponding to this error.
   */
  source: Source | void;

  /**
   * An array of character offsets within the source GraphQL document
   * which correspond to this error.
   */
  positions: Array<number> | void;

  /**
   * The original error thrown from a field resolver during execution.
   */
  originalError: ?Error;
}

export function GraphQLError( // eslint-disable-line no-redeclare
  message: string,
  nodes?: ?Array<*>,
  source?: ?Source,
  positions?: ?Array<number>,
  path?: ?Array<string | number>,
  originalError?: ?Error
) {
  // Include (non-enumerable) stack trace.
  if (originalError && originalError.stack) {
    Object.defineProperty(this, 'stack', {
      value: originalError.stack,
      writable: true,
      configurable: true
    });
  } else if (Error.captureStackTrace) {
    Error.captureStackTrace(this, GraphQLError);
  } else {
    Object.defineProperty(this, 'stack', {
      value: Error().stack,
      writable: true,
      configurable: true
    });
  }

  // Compute locations in the source for the given nodes/positions.
  let _source = source;
  if (!_source && nodes && nodes.length > 0) {
    const node = nodes[0];
    _source = node && node.loc && node.loc.source;
  }

  let _positions = positions;
  if (!_positions && nodes) {
    _positions = nodes.filter(node => Boolean(node.loc))
      .map(node => node.loc.start);
  }
  if (_positions && _positions.length === 0) {
    _positions = undefined;
  }

  let _locations;
  const _source2 = _source; // seems here Flow need a const to resolve type.
  if (_source2 && _positions) {
    _locations = _positions.map(pos => getLocation(_source2, pos));
  }

  Object.defineProperties(this, {
    message: {
      value: message,
      // By being enumerable, JSON.stringify will include `message` in the
      // resulting output. This ensures that the simplist possible GraphQL
      // service adheres to the spec.
      enumerable: true,
      writable: true
    },
    locations: {
      // Coercing falsey values to undefined ensures they will not be included
      // in JSON.stringify() when not provided.
      value: _locations || undefined,
      // By being enumerable, JSON.stringify will include `locations` in the
      // resulting output. This ensures that the simplist possible GraphQL
      // service adheres to the spec.
      enumerable: true
    },
    path: {
      // Coercing falsey values to undefined ensures they will not be included
      // in JSON.stringify() when not provided.
      value: path || undefined,
      // By being enumerable, JSON.stringify will include `path` in the
      // resulting output. This ensures that the simplist possible GraphQL
      // service adheres to the spec.
      enumerable: true
    },
    nodes: {
      value: nodes || undefined
    },
    source: {
      value: _source || undefined,
    },
    positions: {
      value: _positions || undefined,
    },
    originalError: {
      value: originalError
    }
  });
}

(GraphQLError: any).prototype = Object.create(Error.prototype, {
  constructor: { value: GraphQLError },
  name: { value: 'GraphQLError' }
});
