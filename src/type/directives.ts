import type { ObjMap } from '../jsutils/ObjMap';
import { inspect } from '../jsutils/inspect';
import { toObjMap } from '../jsutils/toObjMap';
import { keyValMap } from '../jsutils/keyValMap';
import { devAssert } from '../jsutils/devAssert';
import { instanceOf } from '../jsutils/instanceOf';
import { isObjectLike } from '../jsutils/isObjectLike';
import type { Maybe } from '../jsutils/Maybe';

import type { DirectiveDefinitionNode } from '../language/ast';
import type { DirectiveLocationEnum } from '../language/directiveLocation';
import { DirectiveLocation } from '../language/directiveLocation';

import type { GraphQLArgumentConfig } from './definition';
import {
  GraphQLArgument,
  GraphQLSchemaElement,
  GraphQLNonNull,
} from './definition';
import { GraphQLString, GraphQLBoolean } from './scalars';

/**
 * Test if the given value is a GraphQL directive.
 */
export function isDirective(directive: unknown): directive is GraphQLDirective {
  return instanceOf(directive, GraphQLDirective);
}

export function assertDirective(directive: unknown): GraphQLDirective {
  if (!isDirective(directive)) {
    throw new Error(
      `Expected ${inspect(directive)} to be a GraphQL directive.`,
    );
  }
  return directive;
}

/**
 * Custom extensions
 *
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLDirectiveExtensions {
  [attributeName: string]: unknown;
}

/**
 * Directives are used by the GraphQL runtime as a way of modifying execution
 * behavior. Type system creators will usually not create these directly.
 */
export class GraphQLDirective extends GraphQLSchemaElement {
  name: string;
  description: Maybe<string>;
  locations: Array<DirectiveLocationEnum>;
  args: ReadonlyArray<GraphQLArgument>;
  isRepeatable: boolean;
  extensions: Maybe<Readonly<GraphQLDirectiveExtensions>>;
  astNode: Maybe<DirectiveDefinitionNode>;

  constructor(config: Readonly<GraphQLDirectiveConfig>) {
    const coordinate = `@${config.name}`;
    super(coordinate);
    this.name = config.name;
    this.description = config.description;
    this.locations = config.locations;
    this.isRepeatable = config.isRepeatable ?? false;
    this.extensions = config.extensions && toObjMap(config.extensions);
    this.astNode = config.astNode;

    devAssert(config.name, 'Directive must be named.');
    devAssert(
      Array.isArray(config.locations),
      `${coordinate} locations must be an Array.`,
    );

    const args = config.args ?? {};
    devAssert(
      isObjectLike(args) && !Array.isArray(args),
      `${coordinate} args must be an object with argument names as keys.`,
    );

    this.args = Object.entries(args).map(
      ([argName, argConfig]) =>
        new GraphQLArgument(coordinate, argName, argConfig),
    );
  }

  toConfig(): GraphQLDirectiveNormalizedConfig {
    return {
      name: this.name,
      description: this.description,
      locations: this.locations,
      args: keyValMap(
        this.args,
        (arg) => arg.name,
        (arg) => arg.toConfig(),
      ),
      isRepeatable: this.isRepeatable,
      extensions: this.extensions,
      astNode: this.astNode,
    };
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLDirective';
  }
}

export interface GraphQLDirectiveConfig {
  name: string;
  description?: Maybe<string>;
  locations: Array<DirectiveLocationEnum>;
  args?: Maybe<ObjMap<GraphQLArgumentConfig>>;
  isRepeatable?: Maybe<boolean>;
  extensions?: Maybe<Readonly<GraphQLDirectiveExtensions>>;
  astNode?: Maybe<DirectiveDefinitionNode>;
}

interface GraphQLDirectiveNormalizedConfig extends GraphQLDirectiveConfig {
  args: ObjMap<GraphQLArgumentConfig>;
  isRepeatable: boolean;
  extensions: Maybe<Readonly<GraphQLDirectiveExtensions>>;
}

/**
 * Used to conditionally include fields or fragments.
 */
export const GraphQLIncludeDirective: GraphQLDirective = new GraphQLDirective({
  name: 'include',
  description:
    'Directs the executor to include this field or fragment only when the `if` argument is true.',
  locations: [
    DirectiveLocation.FIELD,
    DirectiveLocation.FRAGMENT_SPREAD,
    DirectiveLocation.INLINE_FRAGMENT,
  ],
  args: {
    if: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'Included when true.',
    },
  },
});

/**
 * Used to conditionally skip (exclude) fields or fragments.
 */
export const GraphQLSkipDirective: GraphQLDirective = new GraphQLDirective({
  name: 'skip',
  description:
    'Directs the executor to skip this field or fragment when the `if` argument is true.',
  locations: [
    DirectiveLocation.FIELD,
    DirectiveLocation.FRAGMENT_SPREAD,
    DirectiveLocation.INLINE_FRAGMENT,
  ],
  args: {
    if: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'Skipped when true.',
    },
  },
});

/**
 * Constant string used for default reason for a deprecation.
 */
export const DEFAULT_DEPRECATION_REASON = 'No longer supported';

/**
 * Used to declare element of a GraphQL schema as deprecated.
 */
export const GraphQLDeprecatedDirective: GraphQLDirective =
  new GraphQLDirective({
    name: 'deprecated',
    description: 'Marks an element of a GraphQL schema as no longer supported.',
    locations: [
      DirectiveLocation.FIELD_DEFINITION,
      DirectiveLocation.ARGUMENT_DEFINITION,
      DirectiveLocation.INPUT_FIELD_DEFINITION,
      DirectiveLocation.ENUM_VALUE,
    ],
    args: {
      reason: {
        type: GraphQLString,
        description:
          'Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax, as specified by [CommonMark](https://commonmark.org/).',
        defaultValue: DEFAULT_DEPRECATION_REASON,
      },
    },
  });

/**
 * Used to provide a URL for specifying the behaviour of custom scalar definitions.
 */
export const GraphQLSpecifiedByDirective: GraphQLDirective =
  new GraphQLDirective({
    name: 'specifiedBy',
    description: 'Exposes a URL that specifies the behaviour of this scalar.',
    locations: [DirectiveLocation.SCALAR],
    args: {
      url: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'The URL that specifies the behaviour of this scalar.',
      },
    },
  });

/**
 * The full list of specified directives.
 */
export const specifiedDirectives: ReadonlyArray<GraphQLDirective> =
  Object.freeze([
    GraphQLIncludeDirective,
    GraphQLSkipDirective,
    GraphQLDeprecatedDirective,
    GraphQLSpecifiedByDirective,
  ]);

export function isSpecifiedDirective(directive: GraphQLDirective): boolean {
  return specifiedDirectives.some(({ name }) => name === directive.name);
}
