/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { GraphQLNonNull } from './definition';
import type { GraphQLType } from './definition';
import { GraphQLBoolean } from './scalars';


/**
 * Directives are used by the GraphQL runtime as a way of modifying execution
 * behavior. Type system creators will usually not create these directly.
 */
export class GraphQLDirective {
  name: string;
  description: ?string;
  type: GraphQLType;
  onOperation: boolean;
  onFragment: boolean;
  onField: boolean;

  constructor(config: GraphQLDirectiveConfig) {
    this.name = config.name;
    this.description = config.description;
    this.type = config.type;
    this.onOperation = config.onOperation;
    this.onFragment = config.onFragment;
    this.onField = config.onField;
  }
}

type GraphQLDirectiveConfig = {
  name: string;
  description?: string;
  type: GraphQLType;
  onOperation: boolean;
  onFragment: boolean;
  onField: boolean;
}

/**
 * Used to conditionally include fields
 */
export var GraphQLIfDirective = new GraphQLDirective({
  name: 'if',
  description: 'Directs the executor to omit this field if the argument ' +
               'provided is false.',
  type: new GraphQLNonNull(GraphQLBoolean),
  onOperation: false,
  onFragment: false,
  onField: true
});

/**
 * Used to conditionally exclude fields
 */
export var GraphQLUnlessDirective = new GraphQLDirective({
  name: 'unless',
  description: 'Directs the executor to omit this field if the argument ' +
               'provided is true.',
  type: new GraphQLNonNull(GraphQLBoolean),
  onOperation: false,
  onFragment: false,
  onField: true
});
