/** @category Directives */

import { devAssert } from '../jsutils/devAssert.ts';
import { inspect } from '../jsutils/inspect.ts';
import { instanceOf } from '../jsutils/instanceOf.ts';
import { isObjectLike } from '../jsutils/isObjectLike.ts';
import { keyValMap } from '../jsutils/keyValMap.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';
import { toObjMapWithSymbols } from '../jsutils/toObjMap.ts';

import type {
  DirectiveDefinitionNode,
  DirectiveExtensionNode,
} from '../language/ast.ts';
import { DirectiveLocation } from '../language/directiveLocation.ts';

import { assertName } from './assertName.ts';
import type {
  GraphQLArgumentConfig,
  GraphQLFieldNormalizedConfigArgumentMap,
  GraphQLSchemaElement,
} from './definition.ts';
import { GraphQLArgument, GraphQLNonNull } from './definition.ts';
import { GraphQLBoolean, GraphQLInt, GraphQLString } from './scalars.ts';

const directiveSymbol: unique symbol = Symbol('Directive');

/**
 * Test if the given value is a GraphQL directive.
 * @param directive - Value to inspect.
 * @returns True when the value is a GraphQLDirective.
 * @example
 * ```ts
 * import { DirectiveLocation } from 'graphql/language';
 * import { GraphQLDirective, GraphQLString, isDirective } from 'graphql/type';
 *
 * const upper = new GraphQLDirective({
 *   name: 'upper',
 *   locations: [DirectiveLocation.FIELD_DEFINITION],
 * });
 *
 * isDirective(upper); // => true
 * isDirective(GraphQLString); // => false
 * ```
 */
export function isDirective(directive: unknown): directive is GraphQLDirective {
  return instanceOf(directive, directiveSymbol, GraphQLDirective);
}

/**
 * Returns the value as a GraphQLDirective, or throws if it is not a directive.
 * @param directive - Value to inspect.
 * @returns The value typed as a GraphQLDirective.
 * @example
 * ```ts
 * import { DirectiveLocation } from 'graphql/language';
 * import { assertDirective, GraphQLDirective, GraphQLString } from 'graphql/type';
 *
 * const upper = new GraphQLDirective({
 *   name: 'upper',
 *   locations: [DirectiveLocation.FIELD_DEFINITION],
 * });
 *
 * assertDirective(upper); // => upper
 * assertDirective(GraphQLString); // throws an error
 * ```
 */
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
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLDirectiveExtensions {
  [attributeName: string | symbol]: unknown;
}

/**
 * Directives are used by the GraphQL runtime as a way of modifying execution
 * behavior. Type system creators will usually not create these directly.
 */
export class GraphQLDirective implements GraphQLSchemaElement {
  /** Internal runtime marker used to identify GraphQLDirective instances. */
  readonly __kind: symbol;
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** Locations where this directive may be applied. */
  locations: ReadonlyArray<DirectiveLocation>;
  /** Arguments accepted by this field or directive. */
  args: ReadonlyArray<GraphQLArgument>;
  /** Whether this directive may appear more than once at the same location. */
  isRepeatable: boolean;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason: Maybe<string>;
  /** Extension fields to include in the formatted result. */
  extensions: Readonly<GraphQLDirectiveExtensions>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<DirectiveDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes: ReadonlyArray<DirectiveExtensionNode>;

  /**
   * Creates a GraphQLDirective instance.
   * @param config - Configuration describing this object.
   * @example
   * ```ts
   * import { DirectiveLocation, parse } from 'graphql/language';
   * import {
   *   GraphQLBoolean,
   *   GraphQLDirective,
   *   GraphQLInt,
   *   GraphQLNonNull,
   * } from 'graphql/type';
   *
   * const document = parse(`
   *   directive @cacheControl(maxAge: Int) repeatable on FIELD_DEFINITION
   *   extend directive @cacheControl(maxAge: Int) on FIELD_DEFINITION
   * `);
   * const definition = document.definitions[0];
   *
   * const cacheControl = new GraphQLDirective({
   *   name: 'cacheControl',
   *   description: 'Controls HTTP cache hints for a field.',
   *   locations: [DirectiveLocation.FIELD_DEFINITION],
   *   args: {
   *     inheritMaxAge: {
   *       description: 'Inherit the parent cache hint.',
   *       type: new GraphQLNonNull(GraphQLBoolean),
   *       default: { value: false },
   *       deprecationReason: 'Use maxAge instead.',
   *       extensions: { scope: 'cache' },
   *     },
   *     maxAge: {
   *       type: GraphQLInt,
   *       astNode: definition.arguments[0],
   *     },
   *   },
   *   isRepeatable: true,
   *   deprecationReason: 'Use @cache instead.',
   *   extensions: { scope: 'cache' },
   *   astNode: definition,
   *   extensionASTNodes: [ document.definitions[1] ],
   * });
   *
   * cacheControl.name; // => 'cacheControl'
   * cacheControl.description; // => 'Controls HTTP cache hints for a field.'
   * cacheControl.args[0].name; // => 'inheritMaxAge'
   * cacheControl.args[0].default.value; // => false
   * cacheControl.isRepeatable; // => true
   * cacheControl.extensions; // => { scope: 'cache' }
   * ```
   */
  constructor(config: Readonly<GraphQLDirectiveConfig>) {
    this.__kind = directiveSymbol;
    this.name = assertName(config.name);
    this.description = config.description;
    this.locations = config.locations;
    this.isRepeatable = config.isRepeatable ?? false;
    this.deprecationReason = config.deprecationReason;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    devAssert(
      Array.isArray(config.locations),
      `@${this.name} locations must be an Array.`,
    );

    const args = config.args ?? {};
    devAssert(
      isObjectLike(args) && !Array.isArray(args),
      `@${this.name} args must be an object with argument names as keys.`,
    );

    this.args = Object.entries(args).map(
      ([argName, argConfig]) => new GraphQLArgument(this, argName, argConfig),
    );
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
    return 'GraphQLDirective';
  }

  /**
   * Returns a normalized configuration object for this object.
   * @returns A configuration object that can be used to recreate this object.
   * @example
   * ```ts
   * import { DirectiveLocation } from 'graphql/language';
   * import { GraphQLDirective, GraphQLString } from 'graphql/type';
   *
   * const tag = new GraphQLDirective({
   *   name: 'tag',
   *   locations: [DirectiveLocation.FIELD_DEFINITION],
   *   args: {
   *     name: { type: GraphQLString },
   *   },
   * });
   *
   * const config = tag.toConfig();
   * const tagCopy = new GraphQLDirective(config);
   *
   * config.args.name.type; // => GraphQLString
   * tagCopy.args[0].name; // => 'name'
   * ```
   */
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
      deprecationReason: this.deprecationReason,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
    };
  }

  /**
   * Returns the schema coordinate identifying this directive.
   * @returns The directive schema coordinate.
   * @example
   * ```ts
   * import { DirectiveLocation } from 'graphql/language';
   * import { GraphQLDirective } from 'graphql/type';
   *
   * const tag = new GraphQLDirective({
   *   name: 'tag',
   *   locations: [DirectiveLocation.FIELD_DEFINITION],
   * });
   *
   * tag.toString(); // => '@tag'
   * ```
   */
  toString(): string {
    return '@' + this.name;
  }

  /**
   * Returns the JSON representation used when this object is serialized.
   * @returns The JSON-serializable representation.
   * @example
   * ```ts
   * import { DirectiveLocation } from 'graphql/language';
   * import { GraphQLDirective } from 'graphql/type';
   *
   * const tag = new GraphQLDirective({
   *   name: 'tag',
   *   locations: [DirectiveLocation.FIELD_DEFINITION],
   * });
   *
   * tag.toJSON(); // => '@tag'
   * JSON.stringify({ directive: tag }); // => '{"directive":"@tag"}'
   * ```
   */
  toJSON(): string {
    return this.toString();
  }
}

/** Configuration used to construct a GraphQLDirective. */
export interface GraphQLDirectiveConfig {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** Locations where this directive may be applied. */
  locations: ReadonlyArray<DirectiveLocation>;
  /** Arguments accepted by this field or directive. */
  args?: Maybe<ObjMap<GraphQLArgumentConfig>>;
  /** Whether this directive may appear more than once at the same location. */
  isRepeatable?: Maybe<boolean>;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason?: Maybe<string>;
  /** Extension fields to include in the formatted result. */
  extensions?: Maybe<Readonly<GraphQLDirectiveExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<DirectiveDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes?: Maybe<ReadonlyArray<DirectiveExtensionNode>>;
}

/** @internal */
export interface GraphQLDirectiveNormalizedConfig extends GraphQLDirectiveConfig {
  args: GraphQLFieldNormalizedConfigArgumentMap;
  isRepeatable: boolean;
  extensions: Readonly<GraphQLDirectiveExtensions>;
  extensionASTNodes: ReadonlyArray<DirectiveExtensionNode>;
}

/** Used to conditionally include fields or fragments. */
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

/** Used to conditionally skip (exclude) fields or fragments. */
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
 * Experimental directive used to conditionally defer fragments.
 *
 * This directive is exported for schemas that explicitly opt in to incremental
 * delivery. It is not included in `specifiedDirectives`.
 */
export const GraphQLDeferDirective: GraphQLDirective = new GraphQLDirective({
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
      default: { value: true },
    },
    label: {
      type: GraphQLString,
      description: 'Unique name',
    },
  },
});

/**
 * Experimental directive used to conditionally stream list fields.
 *
 * This directive is exported for schemas that explicitly opt in to incremental
 * delivery. It is not included in `specifiedDirectives`.
 */
export const GraphQLStreamDirective: GraphQLDirective = new GraphQLDirective({
  name: 'stream',
  description:
    'Directs the executor to stream plural fields when the `if` argument is true or undefined.',
  locations: [DirectiveLocation.FIELD],
  args: {
    initialCount: {
      default: { value: 0 },
      type: new GraphQLNonNull(GraphQLInt),
      description: 'Number of items to return immediately',
    },
    if: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'Stream when true or undefined.',
      default: { value: true },
    },
    label: {
      type: GraphQLString,
      description: 'Unique name',
    },
  },
});

/** Constant string used for default reason for a deprecation. */
export const DEFAULT_DEPRECATION_REASON = 'No longer supported';

/**
 * Used to declare element of a GraphQL schema as deprecated.
 *
 * The `reason` argument is non-null and defaults to
 * `DEFAULT_DEPRECATION_REASON`.
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
      DirectiveLocation.DIRECTIVE_DEFINITION,
    ],
    args: {
      reason: {
        type: new GraphQLNonNull(GraphQLString),
        description:
          'Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax, as specified by [CommonMark](https://commonmark.org/).',
        default: { value: DEFAULT_DEPRECATION_REASON },
      },
    },
  });

/** Used to provide a URL for specifying the behavior of custom scalar definitions. */
export const GraphQLSpecifiedByDirective: GraphQLDirective =
  new GraphQLDirective({
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

/** Used to indicate an Input Object is a OneOf Input Object. */
export const GraphQLOneOfDirective: GraphQLDirective = new GraphQLDirective({
  name: 'oneOf',
  description:
    'Indicates exactly one field must be supplied and this field must not be `null`.',
  locations: [DirectiveLocation.INPUT_OBJECT],
  args: {},
});

/**
 * Disables error propagation (experimental).
 *
 * @internal
 */
export const GraphQLDisableErrorPropagationDirective: GraphQLDirective =
  new GraphQLDirective({
    name: 'experimental_disableErrorPropagation',
    description: 'Disables error propagation.',
    locations: [
      DirectiveLocation.QUERY,
      DirectiveLocation.MUTATION,
      DirectiveLocation.SUBSCRIPTION,
    ],
  });

/**
 * Full list of stable directives specified by GraphQL.js.
 *
 * Experimental `@defer` and `@stream` are exported separately and are not
 * included in this list.
 */
export const specifiedDirectives: ReadonlyArray<GraphQLDirective> =
  Object.freeze([
    GraphQLIncludeDirective,
    GraphQLSkipDirective,
    GraphQLDeprecatedDirective,
    GraphQLSpecifiedByDirective,
    GraphQLOneOfDirective,
  ]);

/**
 * Returns true when the directive is one of the directives specified by GraphQL.
 * @param directive - Directive to inspect.
 * @returns True when the directive is specified by GraphQL.
 * @example
 * ```ts
 * import {
 *   GraphQLDirective,
 *   GraphQLIncludeDirective,
 *   isSpecifiedDirective,
 * } from 'graphql/type';
 * import { DirectiveLocation } from 'graphql/language';
 *
 * const customDirective = new GraphQLDirective({
 *   name: 'auth',
 *   locations: [DirectiveLocation.FIELD_DEFINITION],
 * });
 *
 * isSpecifiedDirective(GraphQLIncludeDirective); // => true
 * isSpecifiedDirective(customDirective); // => false
 * ```
 */
export function isSpecifiedDirective(directive: GraphQLDirective): boolean {
  return specifiedDirectives.some(({ name }) => name === directive.name);
}
