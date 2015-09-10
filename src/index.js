/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// The primary entry point into fulfilling a GraphQL request.
export { graphql } from './graphql';

// Produce a GraphQL type schema.
export { GraphQLSchema } from './type/schema';

// Define GraphQL types.
export {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLRawObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull
} from './type/definition';

// Use pre-defined GraphQL scalar types.
export {
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLID
} from './type/scalars';

// Format GraphQL errors.
export { formatError } from './error/formatError';
