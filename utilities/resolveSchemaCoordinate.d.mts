/** @category Schema Coordinates */
import type { SchemaCoordinateNode } from "../language/ast.mjs";
import type { Source } from "../language/source.mjs";
import type { GraphQLArgument, GraphQLEnumType, GraphQLEnumValue, GraphQLField, GraphQLInputField, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLNamedType, GraphQLObjectType } from "../type/definition.mjs";
import type { GraphQLDirective } from "../type/directives.mjs";
import type { GraphQLSchema } from "../type/schema.mjs";
/**
 * A resolved schema element may be one of the following kinds:
 *
 * @internal
 */
export interface ResolvedNamedType {
    readonly kind: 'NamedType';
    readonly type: GraphQLNamedType;
}
/** @internal */
export interface ResolvedField {
    readonly kind: 'Field';
    readonly type: GraphQLObjectType | GraphQLInterfaceType;
    readonly field: GraphQLField<unknown, unknown>;
}
/** @internal */
export interface ResolvedInputField {
    readonly kind: 'InputField';
    readonly type: GraphQLInputObjectType;
    readonly inputField: GraphQLInputField;
}
/** @internal */
export interface ResolvedEnumValue {
    readonly kind: 'EnumValue';
    readonly type: GraphQLEnumType;
    readonly enumValue: GraphQLEnumValue;
}
/** @internal */
export interface ResolvedFieldArgument {
    readonly kind: 'FieldArgument';
    readonly type: GraphQLObjectType | GraphQLInterfaceType;
    readonly field: GraphQLField<unknown, unknown>;
    readonly fieldArgument: GraphQLArgument;
}
/** @internal */
export interface ResolvedDirective {
    readonly kind: 'Directive';
    readonly directive: GraphQLDirective;
}
/** @internal */
export interface ResolvedDirectiveArgument {
    readonly kind: 'DirectiveArgument';
    readonly directive: GraphQLDirective;
    readonly directiveArgument: GraphQLArgument;
}
/** A schema element resolved from a schema coordinate. */
export type ResolvedSchemaElement = ResolvedNamedType | ResolvedField | ResolvedInputField | ResolvedEnumValue | ResolvedFieldArgument | ResolvedDirective | ResolvedDirectiveArgument;
/**
 * A schema coordinate is resolved in the context of a GraphQL schema to
 * uniquely identify a schema element. It returns undefined if the schema
 * coordinate does not resolve to a schema element, meta-field, or introspection
 * schema element. It will throw if the containing schema element (if
 * applicable) does not exist.
 *
 * https://spec.graphql.org/draft/#sec-Schema-Coordinates.Semantics
 * @param schema - GraphQL schema to use.
 * @param schemaCoordinate - The schema coordinate to resolve.
 * @returns The schema element identified by the coordinate, or undefined if none exists.
 * @example
 * ```ts
 * import { buildSchema, resolveSchemaCoordinate } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   directive @tag(name: String!) on FIELD_DEFINITION
 *
 *   input ReviewInput {
 *     stars: Int!
 *   }
 *
 *   enum Episode {
 *     NEW_HOPE
 *   }
 *
 *   type Query {
 *     reviews(input: ReviewInput): [String] @tag(name: "reviews")
 *   }
 * `);
 *
 * resolveSchemaCoordinate(schema, 'Query')?.kind; // => 'NamedType'
 * resolveSchemaCoordinate(schema, 'Query.reviews')?.kind; // => 'Field'
 * resolveSchemaCoordinate(schema, 'Query.reviews(input:)')?.kind; // => 'FieldArgument'
 * resolveSchemaCoordinate(schema, 'ReviewInput.stars')?.kind; // => 'InputField'
 * resolveSchemaCoordinate(schema, 'Episode.NEW_HOPE')?.kind; // => 'EnumValue'
 * resolveSchemaCoordinate(schema, '@tag')?.kind; // => 'Directive'
 * resolveSchemaCoordinate(schema, '@tag(name:)')?.kind; // => 'DirectiveArgument'
 * resolveSchemaCoordinate(schema, 'Query.missing'); // => undefined
 * ```
 */
export declare function resolveSchemaCoordinate(schema: GraphQLSchema, schemaCoordinate: string | Source): ResolvedSchemaElement | undefined;
/**
 * Resolves schema coordinate from a parsed SchemaCoordinate node.
 * @param schema - GraphQL schema to use.
 * @param schemaCoordinate - The schema coordinate to resolve.
 * @returns The schema element identified by the parsed coordinate, or undefined if none exists.
 * @example
 * ```ts
 * import assert from 'node:assert/strict';
 * import { parseSchemaCoordinate } from 'graphql/language';
 * import { buildSchema, resolveASTSchemaCoordinate } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting(name: String): String
 *   }
 * `);
 * const coordinate = parseSchemaCoordinate('Query.greeting(name:)');
 * const resolved = resolveASTSchemaCoordinate(schema, coordinate);
 *
 * assert(resolved?.kind === 'FieldArgument');
 * resolved.field.name; // => 'greeting'
 * resolved.fieldArgument.name; // => 'name'
 * ```
 */
export declare function resolveASTSchemaCoordinate(schema: GraphQLSchema, schemaCoordinate: SchemaCoordinateNode): ResolvedSchemaElement | undefined;
