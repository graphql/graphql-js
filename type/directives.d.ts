/** @category Directives */
import type { Maybe } from "../jsutils/Maybe.js";
import type { ObjMap } from "../jsutils/ObjMap.js";
import type { DirectiveDefinitionNode, DirectiveExtensionNode } from "../language/ast.js";
import { DirectiveLocation } from "../language/directiveLocation.js";
import type { GraphQLArgumentConfig, GraphQLFieldNormalizedConfigArgumentMap, GraphQLSchemaElement } from "./definition.js";
import { GraphQLArgument } from "./definition.js";
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
export declare function isDirective(directive: unknown): directive is GraphQLDirective;
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
export declare function assertDirective(directive: unknown): GraphQLDirective;
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
export declare class GraphQLDirective implements GraphQLSchemaElement {
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
    /** Custom extension fields reserved for users. */
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
     *   extend directive @cacheControl @tag
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
     *   extensionASTNodes: [document.definitions[1]],
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
    constructor(config: Readonly<GraphQLDirectiveConfig>);
    /**
     * Returns the value used by `Object.prototype.toString`.
     * @returns The built-in string tag for this object.
     */
    get [Symbol.toStringTag](): string;
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
    toConfig(): GraphQLDirectiveNormalizedConfig;
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
    toString(): string;
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
    toJSON(): string;
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
    /** Custom extension fields reserved for users. */
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
export declare const GraphQLIncludeDirective: GraphQLDirective;
/** Used to conditionally skip (exclude) fields or fragments. */
export declare const GraphQLSkipDirective: GraphQLDirective;
/**
 * Experimental directive used to conditionally defer fragments.
 *
 * This directive is exported for schemas that explicitly opt in to incremental
 * delivery. It is not included in `specifiedDirectives`.
 */
export declare const GraphQLDeferDirective: GraphQLDirective;
/**
 * Experimental directive used to conditionally stream list fields.
 *
 * This directive is exported for schemas that explicitly opt in to incremental
 * delivery. It is not included in `specifiedDirectives`.
 */
export declare const GraphQLStreamDirective: GraphQLDirective;
/** Constant string used for default reason for a deprecation. */
export declare const DEFAULT_DEPRECATION_REASON = "No longer supported";
/**
 * Used to declare element of a GraphQL schema as deprecated.
 *
 * The `reason` argument is non-null and defaults to
 * `DEFAULT_DEPRECATION_REASON`.
 */
export declare const GraphQLDeprecatedDirective: GraphQLDirective;
/** Used to provide a URL for specifying the behavior of custom scalar definitions. */
export declare const GraphQLSpecifiedByDirective: GraphQLDirective;
/** Used to indicate an Input Object is a OneOf Input Object. */
export declare const GraphQLOneOfDirective: GraphQLDirective;
/**
 * Disables error propagation (experimental).
 *
 * @internal
 */
export declare const GraphQLDisableErrorPropagationDirective: GraphQLDirective;
/**
 * Full list of stable directives specified by GraphQL.js.
 *
 * Experimental `@defer` and `@stream` are exported separately and are not
 * included in this list.
 */
export declare const specifiedDirectives: ReadonlyArray<GraphQLDirective>;
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
export declare function isSpecifiedDirective(directive: GraphQLDirective): boolean;
