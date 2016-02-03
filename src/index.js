/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

/**
 * GraphQL.js provides a reference implementation for the GraphQL specification
 * but is also a useful utility for operating on GraphQL files and building
 * sophisticated tools.
 *
 * This primary module exports a general purpose function for fulfilling all
 * steps of the GraphQL specification in a single operation, but also includes
 * utilities for every part of the GraphQL specification:
 *
 *   - Parsing the GraphQL language.
 *   - Building a GraphQL type schema.
 *   - Validating a GraphQL request against a type schema.
 *   - Executing a GraphQL request against a type schema.
 *
 * This also includes utility functions for operating on GraphQL types and
 * GraphQL documents to facilitate building tools.
 *
 * You may also import from each sub-directory directly. For example, the
 * following two import statements are equivalent:
 *
 *     import { parse } from 'graphql';
 *     import { parse } from 'graphql/language';
 */

// The primary entry point into fulfilling a GraphQL request.
export {
  graphql
} from './graphql';


// Create and operate on GraphQL type definitions and schema.
export {
  GraphQLSchema,

  // Definitions
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,

  // Scalars
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLID,

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
} from './type';


// Parse and operate on GraphQL language source files.
export {
  Source,
  getLocation,

  // Parse
  parse,
  parseValue,

  // Print
  print,

  // Visit
  visit,
  Kind,
  BREAK,
} from './language';


// Execute GraphQL queries.
export {
  execute,
} from './execution';


// Validate GraphQL queries.
export {
  validate,
  specifiedRules,
} from './validation';


// Create and format GraphQL errors.
export {
  GraphQLError,
  formatError,
} from './error';


// Utilities for operating on GraphQL type schema and parsed sources.
export {
  // The GraphQL query recommended for a full schema introspection.
  introspectionQuery,

  // Gets the target Operation from a Document
  getOperationAST,

  // Build a GraphQLSchema from an introspection result.
  buildClientSchema,

  // Build a GraphQLSchema from a parsed GraphQL Schema language AST.
  buildASTSchema,

  // Extends an existing GraphQLSchema from a parsed GraphQL Schema
  // language AST.
  extendSchema,

  // Print a GraphQLSchema to GraphQL Schema language.
  printSchema,

  // Create a GraphQLType from a GraphQL language AST.
  typeFromAST,

  // Create a JavaScript value from a GraphQL language AST.
  valueFromAST,

  // Create a GraphQL language AST from a JavaScript value.
  astFromValue,

  // A helper to use within recursive-descent visitors which need to be aware of
  // the GraphQL type system.
  TypeInfo,

  // Determine if JavaScript values adhere to a GraphQL type.
  isValidJSValue,

  // Determine if AST values adhere to a GraphQL type.
  isValidLiteralValue,

  // Concatenates multiple AST together.
  concatAST,

  // Comparators for types
  isEqualType,
  isTypeSubTypeOf,
  doTypesOverlap,
} from './utilities';
