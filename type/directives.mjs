import { inspect } from '../jsutils/inspect.mjs';
import { instanceOf } from '../jsutils/instanceOf.mjs';
import { toObjMap } from '../jsutils/toObjMap.mjs';
import { DirectiveLocation } from '../language/directiveLocation.mjs';
import { assertName } from './assertName.mjs';
import {
  argsToArgsConfig,
  defineArguments,
  GraphQLNonNull,
} from './definition.mjs';
import { GraphQLBoolean, GraphQLInt, GraphQLString } from './scalars.mjs';
/**
 * Test if the given value is a GraphQL directive.
 */
export function isDirective(directive) {
  return instanceOf(directive, GraphQLDirective);
}
export function assertDirective(directive) {
  if (!isDirective(directive)) {
    throw new Error(
      `Expected ${inspect(directive)} to be a GraphQL directive.`,
    );
  }
  return directive;
}
/**
 * Directives are used by the GraphQL runtime as a way of modifying execution
 * behavior. Type system creators will usually not create these directly.
 */
export class GraphQLDirective {
  constructor(config) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.locations = config.locations;
    this.isRepeatable = config.isRepeatable ?? false;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    const args = config.args ?? {};
    this.args = defineArguments(args);
  }
  get [Symbol.toStringTag]() {
    return 'GraphQLDirective';
  }
  toConfig() {
    return {
      name: this.name,
      description: this.description,
      locations: this.locations,
      args: argsToArgsConfig(this.args),
      isRepeatable: this.isRepeatable,
      extensions: this.extensions,
      astNode: this.astNode,
    };
  }
  toString() {
    return '@' + this.name;
  }
  toJSON() {
    return this.toString();
  }
}
/**
 * Used to conditionally include fields or fragments.
 */
export const GraphQLIncludeDirective = new GraphQLDirective({
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
export const GraphQLSkipDirective = new GraphQLDirective({
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
 * Used to conditionally defer fragments.
 */
export const GraphQLDeferDirective = new GraphQLDirective({
  name: 'defer',
  description:
    'Directs the executor to defer this fragment when the `if` argument is true or undefined.',
  locations: [
    DirectiveLocation.FRAGMENT_SPREAD,
    DirectiveLocation.INLINE_FRAGMENT,
  ],
  args: {
    if: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'Deferred when true or undefined.',
      defaultValue: true,
    },
    label: {
      type: GraphQLString,
      description: 'Unique name',
    },
  },
});
/**
 * Used to conditionally stream list fields.
 */
export const GraphQLStreamDirective = new GraphQLDirective({
  name: 'stream',
  description:
    'Directs the executor to stream plural fields when the `if` argument is true or undefined.',
  locations: [DirectiveLocation.FIELD],
  args: {
    if: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'Stream when true or undefined.',
      defaultValue: true,
    },
    label: {
      type: GraphQLString,
      description: 'Unique name',
    },
    initialCount: {
      defaultValue: 0,
      type: GraphQLInt,
      description: 'Number of items to return immediately',
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
export const GraphQLDeprecatedDirective = new GraphQLDirective({
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
 * Used to provide a URL for specifying the behavior of custom scalar definitions.
 */
export const GraphQLSpecifiedByDirective = new GraphQLDirective({
  name: 'specifiedBy',
  description: 'Exposes a URL that specifies the behavior of this scalar.',
  locations: [DirectiveLocation.SCALAR],
  args: {
    url: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'The URL that specifies the behavior of this scalar.',
    },
  },
});
/**
 * Used to indicate an Input Object is a OneOf Input Object.
 */
export const GraphQLOneOfDirective = new GraphQLDirective({
  name: 'oneOf',
  description:
    'Indicates exactly one field must be supplied and this field must not be `null`.',
  locations: [DirectiveLocation.INPUT_OBJECT],
  args: {},
});
/**
 * The full list of specified directives.
 */
export const specifiedDirectives = Object.freeze([
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLDeprecatedDirective,
  GraphQLSpecifiedByDirective,
  GraphQLOneOfDirective,
]);
export function isSpecifiedDirective(directive) {
  return specifiedDirectives.some(({ name }) => name === directive.name);
}
