/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import * as Kind from '../language/kinds';
import type {
  NamedTypeNode,
  ListTypeNode,
  NonNullTypeNode,
} from '../language/ast';
import { GraphQLList, GraphQLNonNull } from '../type/wrappers';
import type { GraphQLNamedType } from '../type/definition';
import type { GraphQLSchema } from '../type/schema';

/**
 * Given a Schema and an AST node describing a type, return a GraphQLType
 * definition which applies to that type. For example, if provided the parsed
 * AST node for `[User]`, a GraphQLList instance will be returned, containing
 * the type called "User" found in the schema. If a type called "User" is not
 * found in the schema, then undefined will be returned.
 */
/* eslint-disable no-redeclare */
declare function typeFromAST(
  schema: GraphQLSchema,
  typeNode: NamedTypeNode,
): GraphQLNamedType | void;
declare function typeFromAST(
  schema: GraphQLSchema,
  typeNode: ListTypeNode,
): GraphQLList<any> | void;
declare function typeFromAST(
  schema: GraphQLSchema,
  typeNode: NonNullTypeNode,
): GraphQLNonNull<any> | void;
export function typeFromAST(schema, typeNode) {
  /* eslint-enable no-redeclare */
  let innerType;
  if (typeNode.kind === Kind.LIST_TYPE) {
    innerType = typeFromAST(schema, typeNode.type);
    return innerType && GraphQLList(innerType);
  }
  if (typeNode.kind === Kind.NON_NULL_TYPE) {
    innerType = typeFromAST(schema, typeNode.type);
    return innerType && GraphQLNonNull(innerType);
  }
  if (typeNode.kind === Kind.NAMED_TYPE) {
    return schema.getType(typeNode.name.value);
  }
  /* istanbul ignore next */
  throw new Error(`Unexpected type kind: ${(typeNode.kind: empty)}.`);
}
