/*@flow*/
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// GraphQL Schema definition
export { GraphQLSchema } from './schema';

export {
  // Predicates
  isInputType,
  isOutputType,
  isLeafType,
  isCompositeType,
  isAbstractType,

  // Un-modifiers
  getNullableType,
  getNamedType,

  // Definitions
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from './definition';

// Common built-in scalar instances.
export {
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLID,
} from './scalars';

// Export flow types.

// Note: a future version of flow may support `export type {} from ''`, but
// until then, this is a viable workaround.

// These are unions of the various GraphQL type definitions that are useful
// annotation alongside the GraphQL type predicates.
import type {
  GraphQLType,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLLeafType,
  GraphQLCompositeType,
  GraphQLAbstractType,
  GraphQLNullableType,
  GraphQLNamedType,
} from './definition';
export type GraphQLType = GraphQLType;
export type GraphQLInputType = GraphQLInputType;
export type GraphQLOutputType = GraphQLOutputType;
export type GraphQLLeafType = GraphQLLeafType;
export type GraphQLCompositeType = GraphQLCompositeType;
export type GraphQLAbstractType = GraphQLAbstractType;
export type GraphQLNullableType = GraphQLNullableType;
export type GraphQLNamedType = GraphQLNamedType;
