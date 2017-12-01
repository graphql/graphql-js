/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

// The GraphQL query recommended for a full schema introspection.
export { introspectionQuery } from './introspectionQuery';
export type {
  IntrospectionQuery,
  IntrospectionSchema,
  IntrospectionType,
  IntrospectionInputType,
  IntrospectionOutputType,
  IntrospectionScalarType,
  IntrospectionObjectType,
  IntrospectionInterfaceType,
  IntrospectionUnionType,
  IntrospectionEnumType,
  IntrospectionInputObjectType,
  IntrospectionTypeRef,
  IntrospectionInputTypeRef,
  IntrospectionOutputTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionListTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionField,
  IntrospectionInputValue,
  IntrospectionEnumValue,
  IntrospectionDirective,
} from './introspectionQuery';

// Gets the target Operation from a Document
export { getOperationAST } from './getOperationAST';

// Build a GraphQLSchema from an introspection result.
export { buildClientSchema } from './buildClientSchema';

// Build a GraphQLSchema from GraphQL Schema language.
export { buildASTSchema, buildSchema } from './buildASTSchema';

// Extends an existing GraphQLSchema from a parsed GraphQL Schema language AST.
export { extendSchema } from './extendSchema';

// Print a GraphQLSchema to GraphQL Schema language.
export {
  printSchema,
  printType,
  printIntrospectionSchema,
} from './schemaPrinter';

// Create a GraphQLType from a GraphQL language AST.
export { typeFromAST } from './typeFromAST';

// Create a JavaScript value from a GraphQL language AST.
export { valueFromAST } from './valueFromAST';

// Create a GraphQL language AST from a JavaScript value.
export { astFromValue } from './astFromValue';

// Create a JavaScript value from a GraphQL language AST representation
// of Scalar.
export { scalarValueFromAST } from './scalarValueFromAST';

// A helper to use within recursive-descent visitors which need to be aware of
// the GraphQL type system.
export { TypeInfo } from './TypeInfo';

// Determine if JavaScript values adhere to a GraphQL type.
export { isValidJSValue } from './isValidJSValue';

// Determine if AST values adhere to a GraphQL type.
export { isValidLiteralValue } from './isValidLiteralValue';

// Concatenates multiple AST together.
export { concatAST } from './concatAST';

// Separates an AST into an AST per Operation.
export { separateOperations } from './separateOperations';

// Comparators for types
export {
  isEqualType,
  isTypeSubTypeOf,
  doTypesOverlap,
} from './typeComparators';

// Asserts that a string is a valid GraphQL name
export { assertValidName } from './assertValidName';

// Compares two GraphQLSchemas and detects breaking changes.
export {
  BreakingChangeType,
  DangerousChangeType,
  findBreakingChanges,
  findDangerousChanges,
} from './findBreakingChanges';
export type {
  BreakingChange,
  DangerousChange,
} from './findBreakingChanges';

// Report all deprecated usage within a GraphQL document.
export { findDeprecatedUsages } from './findDeprecatedUsages';
