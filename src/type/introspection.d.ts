import {
  GraphQLObjectType,
  GraphQLField,
  GraphQLEnumType,
  GraphQLNamedType,
} from './definition';

export const __Schema: GraphQLObjectType;
export const __Directive: GraphQLObjectType;
export const __DirectiveLocation: GraphQLEnumType;
export const __Type: GraphQLObjectType;
export const __Field: GraphQLObjectType;
export const __InputValue: GraphQLObjectType;
export const __EnumValue: GraphQLObjectType;

export const TypeKind: Readonly<{
  SCALAR: 'SCALAR';
  OBJECT: 'OBJECT';
  INTERFACE: 'INTERFACE';
  UNION: 'UNION';
  ENUM: 'ENUM';
  INPUT_OBJECT: 'INPUT_OBJECT';
  LIST: 'LIST';
  NON_NULL: 'NON_NULL';
}>;

export const __TypeKind: GraphQLEnumType;

/**
 * Note that these are GraphQLField and not GraphQLFieldConfig,
 * so the format for args is different.
 */

export const SchemaMetaFieldDef: GraphQLField<unknown, unknown>;
export const TypeMetaFieldDef: GraphQLField<unknown, unknown>;
export const TypeNameMetaFieldDef: GraphQLField<unknown, unknown>;

export const introspectionTypes: ReadonlyArray<GraphQLNamedType>;

export function isIntrospectionType(type: GraphQLNamedType): boolean;
