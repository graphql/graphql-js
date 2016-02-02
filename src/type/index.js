/* @flow */
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
  isType,
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
  GraphQLJson
} from './scalars';
