/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { isInputType, GraphQLNonNull } from './definition';
import type {
  GraphQLFieldConfigArgumentMap,
  GraphQLArgument
} from './definition';
import { GraphQLString, GraphQLBoolean } from './scalars';
import invariant from '../jsutils/invariant';
import { assertValidName } from '../utilities/assertValidName';


export const DirectiveLocation = {
  // Operations
  QUERY: 'QUERY',
  MUTATION: 'MUTATION',
  SUBSCRIPTION: 'SUBSCRIPTION',
  FIELD: 'FIELD',
  FRAGMENT_DEFINITION: 'FRAGMENT_DEFINITION',
  FRAGMENT_SPREAD: 'FRAGMENT_SPREAD',
  INLINE_FRAGMENT: 'INLINE_FRAGMENT',
  // Schema Definitions
  SCHEMA: 'SCHEMA',
  SCALAR: 'SCALAR',
  OBJECT: 'OBJECT',
  FIELD_DEFINITION: 'FIELD_DEFINITION',
  ARGUMENT_DEFINITION: 'ARGUMENT_DEFINITION',
  INTERFACE: 'INTERFACE',
  UNION: 'UNION',
  ENUM: 'ENUM',
  ENUM_VALUE: 'ENUM_VALUE',
  INPUT_OBJECT: 'INPUT_OBJECT',
  INPUT_FIELD_DEFINITION: 'INPUT_FIELD_DEFINITION',
};

export type DirectiveLocationEnum = $Keys<typeof DirectiveLocation>; // eslint-disable-line

/**
 * Directives are used by the GraphQL runtime as a way of modifying execution
 * behavior. Type system creators will usually not create these directly.
 */
export class GraphQLDirective {
  name: string;
  description: ?string;
  locations: Array<DirectiveLocationEnum>;
  args: Array<GraphQLArgument>;

  constructor(config: GraphQLDirectiveConfig) {
    invariant(config.name, 'Directive must be named.');
    assertValidName(config.name);
    invariant(
      Array.isArray(config.locations),
      'Must provide locations for directive.'
    );
    this.name = config.name;
    this.description = config.description;
    this.locations = config.locations;

    const args = config.args;
    if (!args) {
      this.args = [];
    } else {
      invariant(
        !Array.isArray(args),
        `@${config.name} args must be an object with argument names as keys.`
      );
      this.args = Object.keys(args).map(argName => {
        assertValidName(argName);
        const arg = args[argName];
        invariant(
          isInputType(arg.type),
          `@${config.name}(${argName}:) argument type must be ` +
          `Input Type but got: ${String(arg.type)}.`
        );
        return {
          name: argName,
          description: arg.description === undefined ? null : arg.description,
          type: arg.type,
          defaultValue: arg.defaultValue
        };
      });
    }
  }
}

type GraphQLDirectiveConfig = {
  name: string;
  description?: ?string;
  locations: Array<DirectiveLocationEnum>;
  args?: ?GraphQLFieldConfigArgumentMap;
};

/**
 * Used to conditionally include fields or fragments.
 */
export const GraphQLIncludeDirective = new GraphQLDirective({
  name: 'include',
  description:
    'Directs the executor to include this field or fragment only when ' +
    'the `if` argument is true.',
  locations: [
    DirectiveLocation.FIELD,
    DirectiveLocation.FRAGMENT_SPREAD,
    DirectiveLocation.INLINE_FRAGMENT,
  ],
  args: {
    if: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'Included when true.'
    }
  },
});

/**
 * Used to conditionally skip (exclude) fields or fragments.
 */
export const GraphQLSkipDirective = new GraphQLDirective({
  name: 'skip',
  description:
    'Directs the executor to skip this field or fragment when the `if` ' +
    'argument is true.',
  locations: [
    DirectiveLocation.FIELD,
    DirectiveLocation.FRAGMENT_SPREAD,
    DirectiveLocation.INLINE_FRAGMENT,
  ],
  args: {
    if: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'Skipped when true.'
    }
  },
});

/**
 * Constant string used for default reason for a deprecation.
 */
export const DEFAULT_DEPRECATION_REASON = 'No longer supported';

/**
 * Used to declare element of a GraphQL schema as deprecated.
 */
export const GraphQLDeprecatedDirective = new GraphQLDirective({
  name: 'deprecated',
  description:
    'Marks an element of a GraphQL schema as no longer supported.',
  locations: [
    DirectiveLocation.FIELD_DEFINITION,
    DirectiveLocation.ENUM_VALUE,
  ],
  args: {
    reason: {
      type: GraphQLString,
      description:
        'Explains why this element was deprecated, usually also including a ' +
        'suggestion for how to access supported similar data. Formatted ' +
        'in [Markdown](https://daringfireball.net/projects/markdown/).',
      defaultValue: DEFAULT_DEPRECATION_REASON
    }
  },
});

/**
 * The full list of specified directives.
 */
export const specifiedDirectives: Array<GraphQLDirective> = [
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLDeprecatedDirective,
];
