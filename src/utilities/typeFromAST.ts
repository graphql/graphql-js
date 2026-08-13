/** @category Values */

import type {
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  TypeNode,
} from '../language/ast';
import { Kind } from '../language/kinds';

import type { GraphQLNamedType, GraphQLType } from '../type/definition';
import { GraphQLList, GraphQLNonNull } from '../type/definition';
import type { GraphQLSchema } from '../type/schema';

/**
 * Given a Schema and an AST node describing a type, return a GraphQLType
 * definition which applies to that type. For example, if provided the parsed
 * AST node for `[User]`, a GraphQLList instance will be returned, containing
 * the type called "User" found in the schema. If a type called "User" is not
 * found in the schema, then undefined will be returned.
 * @param schema - GraphQL schema to use.
 * @param typeNode - The GraphQL type AST node to resolve.
 * @returns The GraphQL type referenced by the AST node, or undefined if it cannot be resolved.
 * @example
 * ```ts
 * import { parseType } from 'graphql/language';
 * import { buildSchema, typeFromAST } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * typeFromAST(schema, parseType('String'))?.toString(); // => 'String'
 * typeFromAST(schema, parseType('Missing')); // => undefined
 * ```
 */
export function typeFromAST(
  schema: GraphQLSchema,
  typeNode: NamedTypeNode,
): GraphQLNamedType | undefined;
/**
 * Resolves a list type AST node against a schema.
 * @param schema - GraphQL schema to use.
 * @param typeNode - The list type AST node to resolve.
 * @returns The GraphQL list type referenced by the AST node, or undefined if
 * it cannot be resolved.
 * @example
 * ```ts
 * import { parseType } from 'graphql/language';
 * import { buildSchema, typeFromAST } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     tags: [String]
 *   }
 * `);
 *
 * typeFromAST(schema, parseType('[String]'))?.toString(); // => '[String]'
 * typeFromAST(schema, parseType('[Missing]')); // => undefined
 * ```
 */
export function typeFromAST(
  schema: GraphQLSchema,
  typeNode: ListTypeNode,
): GraphQLList<any> | undefined;
/**
 * Resolves a non-null type AST node against a schema.
 * @param schema - GraphQL schema to use.
 * @param typeNode - The non-null type AST node to resolve.
 * @returns The GraphQL non-null type referenced by the AST node, or undefined
 * if it cannot be resolved.
 * @example
 * ```ts
 * import { parseType } from 'graphql/language';
 * import { buildSchema, typeFromAST } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String!
 *   }
 * `);
 *
 * typeFromAST(schema, parseType('String!'))?.toString(); // => 'String!'
 * typeFromAST(schema, parseType('[String!]!'))?.toString(); // => '[String!]!'
 * ```
 */
export function typeFromAST(
  schema: GraphQLSchema,
  typeNode: NonNullTypeNode,
): GraphQLNonNull<any> | undefined;
/**
 * Resolves a type AST node against a schema.
 * @param schema - GraphQL schema to use.
 * @param typeNode - The GraphQL type AST node to resolve.
 * @returns The GraphQL type referenced by the AST node, or undefined if it
 * cannot be resolved.
 * @example
 * ```ts
 * import { parseType } from 'graphql/language';
 * import { buildSchema, typeFromAST } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type User {
 *     name: String
 *   }
 *
 *   type Query {
 *     users: [User!]!
 *   }
 * `);
 *
 * typeFromAST(schema, parseType('User'))?.toString(); // => 'User'
 * typeFromAST(schema, parseType('[User!]!'))?.toString(); // => '[User!]!'
 * typeFromAST(schema, parseType('Missing')); // => undefined
 * ```
 */
export function typeFromAST(
  schema: GraphQLSchema,
  typeNode: TypeNode,
): GraphQLType | undefined;
/** @internal */
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
    case Kind.NAMED_TYPE:
      return schema.getType(typeNode.name.value);
  }
}
