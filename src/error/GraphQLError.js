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
  source: Source;
  positions: Array<number>;
  locations: any;
  originalError: ?Error;

  constructor(
    message: string,
    // A flow bug keeps us from declaring nodes as an array of Node
    nodes?: Array<any/* Node */>,
    stack?: ?string,
    source?: Source,
    positions?: Array<number>
  ) {
    super(message);
    this.message = message;

    Object.defineProperty(this, 'stack', { value: stack || message });
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

    Object.defineProperty(this, 'locations', ({
      get() {
        if (this.positions && this.source) {
          return this.positions.map(pos => getLocation(this.source, pos));
        }
      }
    }: any));
  }
}
