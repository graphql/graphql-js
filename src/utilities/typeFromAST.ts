import { inspect } from '../jsutils/inspect';
import { invariant } from '../jsutils/invariant';

import type {
  NamedTypeNode,
  ListTypeNode,
  NonNullTypeNode,
  TypeNode,
} from '../language/ast';

import { Kind } from '../language/kinds';

import type { GraphQLSchema } from '../type/schema';
import type { GraphQLNamedType } from '../type/definition';
import { GraphQLList, GraphQLNonNull } from '../type/definition';

/**
 * Given a Schema and an AST node describing a type, return a GraphQLType
 * definition which applies to that type. For example, if provided the parsed
 * AST node for `[User]`, a GraphQLList instance will be returned, containing
 * the type called "User" found in the schema. If a type called "User" is not
 * found in the schema, then undefined will be returned.
 */
export function typeFromAST<T extends TypeNode>(
  schema: GraphQLSchema,
  typeNode: T,
):
  | (T extends NamedTypeNode
      ? GraphQLNamedType
      : T extends ListTypeNode
      ? GraphQLList<any>
      : T extends NonNullTypeNode
      ? GraphQLNonNull<any>
      : never)
  | undefined;
export function typeFromAST(
  schema: GraphQLSchema,
  typeNode: TypeNode,
): GraphQLNamedType | GraphQLList<any> | GraphQLNonNull<any> | undefined {
  if (typeNode.kind === Kind.LIST_TYPE) {
    const innerType = typeFromAST(schema, typeNode.type);
    return innerType && new GraphQLList(innerType);
  }
  if (typeNode.kind === Kind.NON_NULL_TYPE) {
    const innerType = typeFromAST(schema, typeNode.type);
    return innerType && new GraphQLNonNull(innerType);
  }
  // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')
  if (typeNode.kind === Kind.NAMED_TYPE) {
    return schema.getType(typeNode.name.value);
  }

  // istanbul ignore next (Not reachable. All possible type nodes have been considered)
  invariant(false, 'Unexpected type node: ' + inspect(typeNode as never));
}
