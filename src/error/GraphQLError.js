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
import type { Node } from '../language/ast';
import type { Source } from '../language/source';


export class GraphQLError extends Error {
  message: string;
  stack: string;
  nodes: ?Array<Node>;
  source: ?Source;
  positions: ?Array<number>;
  locations: ?Array<{ line: number, column: number }>;
  path: ?Array<string | number>;
  originalError: ?Error;

  constructor(
    message: string,
    // A flow bug keeps us from declaring nodes as an array of Node
    nodes?: Array<any/* Node */>,
    stack?: ?string,
    source?: ?Source,
    positions?: ?Array<number>,
    path?: ?Array<string|number>,
    originalError?: ?Error
  ) {
    super(message);

    Object.defineProperty(this, 'message', {
      value: message,
      // By being enumerable, JSON.stringify will include `message` in the
      // resulting output. This ensures that the simplist possible GraphQL
      // service adheres to the spec.
      enumerable: true,
      // Note: you really shouldn't overwrite message, but it enables
      // Error brand-checking.
      writable: true,
    });

    if (stack) {
      Object.defineProperty(this, 'stack', {
        value: stack,
        // Note: stack should not really be writable, but some libraries (such
        // as bluebird) use Error brand-checking which specifically looks to see
        // if stack is a writable property.
        writable: true,
      });
    }

    Object.defineProperty(this, 'nodes', { value: nodes });

    // Note: flow does not yet know about Object.defineProperty with `get`.
    Object.defineProperty(this, 'source', ({
      get() {
        if (source) {
          return source;
        }
        if (nodes && nodes.length > 0) {
          const node = nodes[0];
          return node && node.loc && node.loc.source;
        }
      }
    }: any));

    Object.defineProperty(this, 'positions', ({
      get() {
        if (positions) {
          return positions;
        }
        if (nodes) {
          const nodePositions = nodes.map(node => node.loc && node.loc.start);
          if (nodePositions.some(p => p)) {
            return nodePositions;
          }
        }
      }
    }: any));

    if (nodes || positions) {
      Object.defineProperty(this, 'locations', ({
        get() {
          const _positions = this.positions;
          const _source = this.source;
          if (_positions && _positions.length > 0 && _source) {
            return _positions.map(pos => getLocation(_source, pos));
          }
        },
        // By being enumerable, JSON.stringify will include `locations` in the
        // resulting output. This ensures that the simplist possible GraphQL
        // service adheres to the spec.
        enumerable: true,
      }: any));
    }

    if (path) {
      Object.defineProperty(this, 'path', {
        value: path,
        // By being enumerable, JSON.stringify will include `path` in the
        // resulting output. This ensures that the simplist possible GraphQL
        // service adheres to the spec.
        enumerable: true
      });
    }

    Object.defineProperty(this, 'originalError', {
      value: originalError
    });
  }
}
