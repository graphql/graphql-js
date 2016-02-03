/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// The GraphQL query recommended for a full schema introspection.
export { introspectionQuery } from './introspectionQuery';

// Gets the target Operation from a Document
export { getOperationAST } from './getOperationAST';

// Build a GraphQLSchema from an introspection result.
export { buildClientSchema } from './buildClientSchema';

// Build a GraphQLSchema from a parsed GraphQL Schema language AST.
export { buildASTSchema } from './buildASTSchema';

// Extends an existing GraphQLSchema from a parsed GraphQL Schema language AST.
export { extendSchema } from './extendSchema';

// Print a GraphQLSchema to GraphQL Schema language.
export { printSchema, printIntrospectionSchema } from './schemaPrinter';

// Create a GraphQLType from a GraphQL language AST.
export { typeFromAST } from './typeFromAST';

// Create a JavaScript value from a GraphQL language AST.
export { valueFromAST } from './valueFromAST';

// Create a GraphQL language AST from a JavaScript value.
export { astFromValue } from './astFromValue';

// A helper to use within recursive-descent visitors which need to be aware of
// the GraphQL type system.
export { TypeInfo } from './TypeInfo';

// Determine if JavaScript values adhere to a GraphQL type.
export { isValidJSValue } from './isValidJSValue';

// Determine if AST values adhere to a GraphQL type.
export { isValidLiteralValue } from './isValidLiteralValue';

// Concatenates multiple AST together.
export { concatAST } from './concatAST';

// Comparators for types
export {
  isEqualType,
  isTypeSubTypeOf,
  doTypesOverlap
} from './typeComparators';
