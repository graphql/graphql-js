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
  positions: any;
  locations: any;
  source: any;

  constructor(
    message: string,
    // A flow bug keeps us from declaring nodes as an array of Node
    nodes?: Array<any/*Node*/>,
    stack?: any
  ) {
    super(message);
    this.message = message;
    this.stack = stack || message;
    if (nodes) {
      this.nodes = nodes;
      var positions = nodes.map(node => node.loc && node.loc.start);
      if (positions.some(p => !!p)) {
        this.positions = positions;
        var loc = nodes[0].loc;
        var source = loc && loc.source;
        if (source) {
          this.locations = positions.map(pos => getLocation(source, pos));
          this.source = source;
        }
      }
    }
  }
}
