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
import type { GraphQLFieldArgument } from './definition';
import { GraphQLBoolean } from './scalars';


/**
 * Directives are used by the GraphQL runtime as a way of modifying execution
 * behavior. Type system creators will usually not create these directly.
 */
export class GraphQLDirective {
  name: string;
  description: ?string;
  args: Array<GraphQLFieldArgument>;
  onOperation: boolean;
  onFragment: boolean;
  onField: boolean;

  constructor(config: GraphQLDirectiveConfig) {
    this.name = config.name;
    this.description = config.description;
    this.args = config.args;
    this.onOperation = config.onOperation;
    this.onFragment = config.onFragment;
    this.onField = config.onField;
  }
}

type GraphQLDirectiveConfig = {
  name: string;
  description?: string;
  args: Array<GraphQLFieldArgument>;
  onOperation: boolean;
  onFragment: boolean;
  onField: boolean;
}

/**
 * Used to conditionally include fields or fragments
 */
export var GraphQLIncludeDirective = new GraphQLDirective({
  name: 'include',
  description:
    'Directs the executor to include this field or fragment only when ' +
    'the `if` argument is true.',
  args: [
    { name: 'if',
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'Included when true.' }
  ],
  onOperation: false,
  onFragment: true,
  onField: true
});

/**
 * Used to conditionally skip (exclude) fields or fragments
 */
export var GraphQLSkipDirective = new GraphQLDirective({
  name: 'skip',
  description:
    'Directs the executor to skip this field or fragment when the `if` ' +
    'argument is true.',
  args: [
    { name: 'if',
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'Skipped when true.' }
  ],
  onOperation: false,
  onFragment: true,
  onField: true
});
