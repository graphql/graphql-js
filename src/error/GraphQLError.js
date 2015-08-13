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


export class GraphQLError extends Error {
  message: string;
  stack: string;
  nodes: ?Array<Node>;
  source: any;
  positions: any;
  locations: any;

  constructor(
    message: string,
    // A flow bug keeps us from declaring nodes as an array of Node
    nodes?: Array<any/* Node */>,
    stack?: ?string
  ) {
    super(message);
    this.message = message;
    Object.defineProperty(this, 'stack', { value: stack || message });
    Object.defineProperty(this, 'nodes', { value: nodes });
  }
}

// Note: flow does not yet know about Object.defineProperty with `get`.
Object.defineProperty(GraphQLError.prototype, 'source', ({
  get() {
    var nodes = this.nodes;
    if (nodes && nodes.length > 0) {
      var node = nodes[0];
      return node && node.loc && node.loc.source;
    }
  }
}: any));

Object.defineProperty(GraphQLError.prototype, 'positions', ({
  get() {
    var nodes = this.nodes;
    if (nodes) {
      var positions = nodes.map(node => node.loc && node.loc.start);
      if (positions.some(p => p)) {
        return positions;
      }
    }
  }
}: any));

Object.defineProperty(GraphQLError.prototype, 'locations', ({
  get() {
    var positions = this.positions;
    var source = this.source;
    if (positions && source) {
      return positions.map(pos => getLocation(source, pos));
    }
  }
}: any));
