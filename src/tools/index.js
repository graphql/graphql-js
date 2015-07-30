/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// Build a GraphQLSchema from an introspection result.
export {
  buildClientSchema,
} from './buildClientSchema';

// Build a GraphQLSchema from a parsed GraphQL Schema language AST.
export {
  buildASTSchema,
} from './buildASTSchema';

// Print a GraphQLSchema to GraphQL Schema language
export {
  printSchema,
  printIntrospectionSchema,
} from './schemaPrinter';
