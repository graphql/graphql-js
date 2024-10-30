import type { GraphQLField, GraphQLNamedType } from './definition.js';
import { GraphQLEnumType, GraphQLObjectType } from './definition.js';
export declare const __Schema: GraphQLObjectType;
export declare const __Directive: GraphQLObjectType;
export declare const __DirectiveLocation: GraphQLEnumType;
export declare const __Type: GraphQLObjectType;
export declare const __Field: GraphQLObjectType;
export declare const __InputValue: GraphQLObjectType;
export declare const __EnumValue: GraphQLObjectType;
export declare const TypeKind: {
    readonly SCALAR: "SCALAR";
    readonly OBJECT: "OBJECT";
    readonly INTERFACE: "INTERFACE";
    readonly UNION: "UNION";
    readonly ENUM: "ENUM";
    readonly INPUT_OBJECT: "INPUT_OBJECT";
    readonly LIST: "LIST";
    readonly NON_NULL: "NON_NULL";
};
export type TypeKind = (typeof TypeKind)[keyof typeof TypeKind];
export declare const __TypeKind: GraphQLEnumType;
/**
 * Note that these are GraphQLField and not GraphQLFieldConfig,
 * so the format for args is different.
 */
export declare const SchemaMetaFieldDef: GraphQLField<unknown, unknown>;
export declare const TypeMetaFieldDef: GraphQLField<unknown, unknown>;
export declare const TypeNameMetaFieldDef: GraphQLField<unknown, unknown>;
export declare const introspectionTypes: ReadonlyArray<GraphQLNamedType>;
export declare function isIntrospectionType(type: GraphQLNamedType): boolean;
