import type { Maybe } from '../jsutils/Maybe.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { DirectiveDefinitionNode } from '../language/ast.js';
import { DirectiveLocation } from '../language/directiveLocation.js';
import type { GraphQLArgumentConfig, GraphQLFieldNormalizedConfigArgumentMap, GraphQLSchemaElement } from './definition.js';
import { GraphQLArgument } from './definition.js';
/**
 * Test if the given value is a GraphQL directive.
 */
export declare function isDirective(directive: unknown): directive is GraphQLDirective;
export declare function assertDirective(directive: unknown): GraphQLDirective;
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
    [attributeName: string | symbol]: unknown;
}
/**
 * Directives are used by the GraphQL runtime as a way of modifying execution
 * behavior. Type system creators will usually not create these directly.
 */
export declare class GraphQLDirective implements GraphQLSchemaElement {
    name: string;
    description: Maybe<string>;
    locations: ReadonlyArray<DirectiveLocation>;
    args: ReadonlyArray<GraphQLArgument>;
    isRepeatable: boolean;
    extensions: Readonly<GraphQLDirectiveExtensions>;
    astNode: Maybe<DirectiveDefinitionNode>;
    constructor(config: Readonly<GraphQLDirectiveConfig>);
    get [Symbol.toStringTag](): string;
    toConfig(): GraphQLDirectiveNormalizedConfig;
    toString(): string;
    toJSON(): string;
}
export interface GraphQLDirectiveConfig {
    name: string;
    description?: Maybe<string>;
    locations: ReadonlyArray<DirectiveLocation>;
    args?: Maybe<ObjMap<GraphQLArgumentConfig>>;
    isRepeatable?: Maybe<boolean>;
    extensions?: Maybe<Readonly<GraphQLDirectiveExtensions>>;
    astNode?: Maybe<DirectiveDefinitionNode>;
}
export interface GraphQLDirectiveNormalizedConfig extends GraphQLDirectiveConfig {
    args: GraphQLFieldNormalizedConfigArgumentMap;
    isRepeatable: boolean;
    extensions: Readonly<GraphQLDirectiveExtensions>;
}
/**
 * Used to conditionally include fields or fragments.
 */
export declare const GraphQLIncludeDirective: GraphQLDirective;
/**
 * Used to conditionally skip (exclude) fields or fragments.
 */
export declare const GraphQLSkipDirective: GraphQLDirective;
/**
 * Used to conditionally defer fragments.
 */
export declare const GraphQLDeferDirective: GraphQLDirective;
/**
 * Used to conditionally stream list fields.
 */
export declare const GraphQLStreamDirective: GraphQLDirective;
/**
 * Constant string used for default reason for a deprecation.
 */
export declare const DEFAULT_DEPRECATION_REASON = "No longer supported";
/**
 * Used to declare element of a GraphQL schema as deprecated.
 */
export declare const GraphQLDeprecatedDirective: GraphQLDirective;
/**
 * Used to provide a URL for specifying the behavior of custom scalar definitions.
 */
export declare const GraphQLSpecifiedByDirective: GraphQLDirective;
/**
 * Used to indicate an Input Object is a OneOf Input Object.
 */
export declare const GraphQLOneOfDirective: GraphQLDirective;
/**
 * Disables error propagation (experimental).
 */
export declare const GraphQLDisableErrorPropagationDirective: GraphQLDirective;
/**
 * The full list of specified directives.
 */
export declare const specifiedDirectives: ReadonlyArray<GraphQLDirective>;
export declare function isSpecifiedDirective(directive: GraphQLDirective): boolean;
