/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import invariant from '../jsutils/invariant';
import { NAMED_TYPE, LIST_TYPE, NON_NULL_TYPE } from '../language/kinds';
import type { TypeNode } from '../language/ast';
import { GraphQLList, GraphQLNonNull } from '../type/definition';
import type { GraphQLType, GraphQLNullableType } from '../type/definition';
import type { GraphQLSchema } from '../type/schema';


export function typeFromAST(
  schema: GraphQLSchema,
  typeNode: TypeNode
): ?GraphQLType {
  let innerType;
  if (typeNode.kind === LIST_TYPE) {
    innerType = typeFromAST(schema, typeNode.type);
    return innerType && new GraphQLList(innerType);
  }
  if (typeNode.kind === NON_NULL_TYPE) {
    innerType = typeFromAST(schema, typeNode.type);
    return innerType && new GraphQLNonNull(
      ((innerType: any): GraphQLNullableType)
    );
  }
  invariant(typeNode.kind === NAMED_TYPE, 'Must be a named type.');
  return schema.getType(typeNode.name.value);
}
