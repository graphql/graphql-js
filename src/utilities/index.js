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

// Build a GraphQLSchema from an introspection result.
export { buildClientSchema } from './buildClientSchema';

// Build a GraphQLSchema from a parsed GraphQL Schema language AST.
export { buildASTSchema } from './buildASTSchema';

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


// Export flow types.

// Note: a future version of flow may support `export type {} from ''`, but
// until then, this is a viable workaround.

// IntrospectionQuery is the type of the result expected by requesting
// GraphQL with `introspectionQuery`.
import type {
  IntrospectionQuery,
  IntrospectionSchema,
  IntrospectionType,
  IntrospectionScalarType,
  IntrospectionObjectType,
  IntrospectionInterfaceType,
  IntrospectionUnionType,
  IntrospectionEnumType,
  IntrospectionInputObjectType,
  IntrospectionTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionListTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionField,
  IntrospectionInputValue,
  IntrospectionEnumValue,
  IntrospectionDirective,
} from './introspectionQuery';
export type IntrospectionQuery = IntrospectionQuery;
export type IntrospectionSchema = IntrospectionSchema;
export type IntrospectionType = IntrospectionType;
export type IntrospectionScalarType = IntrospectionScalarType;
export type IntrospectionObjectType = IntrospectionObjectType;
export type IntrospectionInterfaceType = IntrospectionInterfaceType;
export type IntrospectionUnionType = IntrospectionUnionType;
export type IntrospectionEnumType = IntrospectionEnumType;
export type IntrospectionInputObjectType = IntrospectionInputObjectType;
export type IntrospectionTypeRef = IntrospectionTypeRef;
export type IntrospectionNamedTypeRef = IntrospectionNamedTypeRef;
export type IntrospectionListTypeRef = IntrospectionListTypeRef;
export type IntrospectionNonNullTypeRef = IntrospectionNonNullTypeRef;
export type IntrospectionField = IntrospectionField;
export type IntrospectionInputValue = IntrospectionInputValue;
export type IntrospectionEnumValue = IntrospectionEnumValue;
export type IntrospectionDirective = IntrospectionDirective;
