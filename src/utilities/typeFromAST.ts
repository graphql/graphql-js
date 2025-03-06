import type {
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  TypeNode,
} from '../language/ast';
import { Kind } from '../language/kinds';

import type { GraphQLNamedType, GraphQLType } from '../type/definition';
import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLSemanticNullable,
} from '../type/definition';
import type { GraphQLSchema } from '../type/schema';

/**
 * Given a Schema and an AST node describing a type, return a GraphQLType
 * definition which applies to that type. For example, if provided the parsed
 * AST node for `[User]`, a GraphQLList instance will be returned, containing
 * the type called "User" found in the schema. If a type called "User" is not
 * found in the schema, then undefined will be returned.
 */
export function typeFromAST(
  schema: GraphQLSchema,
  typeNode: NamedTypeNode,
): GraphQLNamedType | undefined;
export function typeFromAST(
  schema: GraphQLSchema,
  typeNode: ListTypeNode,
): GraphQLList<any> | undefined;
export function typeFromAST(
  schema: GraphQLSchema,
  typeNode: NonNullTypeNode,
): GraphQLNonNull<any> | undefined;
export function typeFromAST(
  schema: GraphQLSchema,
  typeNode: TypeNode,
): GraphQLType | undefined;
export function typeFromAST(
  schema: GraphQLSchema,
  typeNode: TypeNode,
): GraphQLType | undefined {
  switch (typeNode.kind) {
    case Kind.LIST_TYPE: {
      const innerType = typeFromAST(schema, typeNode.type);
      return innerType && new GraphQLList(innerType);
    }
    case Kind.NON_NULL_TYPE: {
      const innerType = typeFromAST(schema, typeNode.type);
      return innerType && new GraphQLNonNull(innerType);
    }
    case Kind.SEMANTIC_NULLABLE_TYPE: {
      const innerType = typeFromAST(schema, typeNode.type);
      return innerType && new GraphQLSemanticNullable(innerType);
    }
    case Kind.NAMED_TYPE:
      return schema.getType(typeNode.name.value);
  }
}
