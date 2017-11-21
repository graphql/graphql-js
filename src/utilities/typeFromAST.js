/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import invariant from '../jsutils/invariant';
import * as Kind from '../language/kinds';
import type {
  NamedTypeNode,
  ListTypeNode,
  NonNullTypeNode
} from '../language/ast';
import { GraphQLList, GraphQLNonNull } from '../type/definition';
import type {
  GraphQLNamedType,
} from '../type/definition';
import type { GraphQLSchema } from '../type/schema';

/**
 * Given a Schema and an AST node describing a type, return a GraphQLType
 * definition which applies to that type. For example, if provided the parsed
 * AST node for `[User]`, a GraphQLList instance will be returned, containing
 * the type called "User" found in the schema. If a type called "User" is not
 * found in the schema, then undefined will be returned.
 */
/* eslint-disable no-redeclare */
declare function typeFromASTType(
  schema: GraphQLSchema,
  typeNode: NamedTypeNode
): void | GraphQLNamedType;
declare function typeFromASTType(
  schema: GraphQLSchema,
  typeNode: ListTypeNode
): void | GraphQLList<*>;
declare function typeFromASTType(
  schema: GraphQLSchema,
  typeNode: NonNullTypeNode
): void | GraphQLNonNull<*>;
function typeFromASTImpl(schema, typeNode) {
/* eslint-enable no-redeclare */
  let innerType;
  if (typeNode.kind === Kind.LIST_TYPE) {
    innerType = typeFromAST(schema, typeNode.type);
    return innerType && new GraphQLList(innerType);
  }
  if (typeNode.kind === Kind.NON_NULL_TYPE) {
    innerType = typeFromAST(schema, typeNode.type);
    return innerType && new GraphQLNonNull(innerType);
  }
  invariant(typeNode.kind === Kind.NAMED_TYPE, 'Must be a named type.');
  return schema.getType(typeNode.name.value);
}
// This will export typeFromAST with the correct type, but currently exposes
// ~26 errors: https://gist.github.com/4a29403a99a8186fcb15064d69c5f3ae
// export var typeFromAST: typeof typeFromASTType = typeFromASTImpl;
export const typeFromAST: $FlowFixMe = typeFromASTImpl;
