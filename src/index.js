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
  GraphQLDirective,

  // "Enum" of Type Kinds
  TypeKind,

  // "Enum" of Directive Locations
  DirectiveLocation,

  // Scalars
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLID,

  // Built-in Directives defined by the Spec
  specifiedDirectives,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLDeprecatedDirective,

  // Constant Deprecation Reason
  DEFAULT_DEPRECATION_REASON,

  // Meta-field definitions.
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,

  // GraphQL Types for introspection.
  __Schema,
  __Directive,
  __DirectiveLocation,
  __Type,
  __Field,
  __InputValue,
  __EnumValue,
  __TypeKind,

  // Predicates
  isType,
  isInputType,
  isOutputType,
  isLeafType,
  isCompositeType,
  isAbstractType,

  // Assertions
  assertType,
  assertInputType,
  assertOutputType,
  assertLeafType,
  assertCompositeType,
  assertAbstractType,

  // Un-modifiers
  getNullableType,
  getNamedType,
} from './type';

export type {
  DirectiveLocationEnum,

  GraphQLType,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLLeafType,
  GraphQLCompositeType,
  GraphQLAbstractType,
  GraphQLNullableType,
  GraphQLNamedType,

  Thunk,
  GraphQLArgument,
  GraphQLArgumentConfig,
  GraphQLEnumTypeConfig,
  GraphQLEnumValue,
  GraphQLEnumValueConfig,
  GraphQLEnumValueConfigMap,
  GraphQLField,
  GraphQLFieldConfig,
  GraphQLFieldConfigArgumentMap,
  GraphQLFieldConfigMap,
  GraphQLFieldMap,
  GraphQLFieldResolver,
  GraphQLInputField,
  GraphQLInputFieldConfig,
  GraphQLInputFieldConfigMap,
  GraphQLInputFieldMap,
  GraphQLInputObjectTypeConfig,
  GraphQLInterfaceTypeConfig,
  GraphQLIsTypeOfFn,
  GraphQLObjectTypeConfig,
  GraphQLResolveInfo,
  ResponsePath,
  GraphQLScalarTypeConfig,
  GraphQLTypeResolver,
  GraphQLUnionTypeConfig,
} from './type';


// Parse and operate on GraphQL language source files.
export {
  Source,
  getLocation,

  // Parse
  parse,
  parseValue,
  parseType,

  // Print
  print,

  // Visit
  visit,
  visitInParallel,
  visitWithTypeInfo,
  Kind,
  TokenKind,
  BREAK,
} from './language';

export type {
  Lexer,
  ParseOptions,

  // AST nodes
  Location,
  Token,
  ASTNode,
  NameNode,
  DocumentNode,
  DefinitionNode,
  OperationDefinitionNode,
  OperationTypeNode,
  VariableDefinitionNode,
  VariableNode,
  SelectionSetNode,
  SelectionNode,
  FieldNode,
  ArgumentNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
  ValueNode,
  IntValueNode,
  FloatValueNode,
  StringValueNode,
  BooleanValueNode,
  NullValueNode,
  EnumValueNode,
  ListValueNode,
  ObjectValueNode,
  ObjectFieldNode,
  DirectiveNode,
  TypeNode,
  NamedTypeNode,
  ListTypeNode,
  NonNullTypeNode,
  TypeSystemDefinitionNode,
  SchemaDefinitionNode,
  OperationTypeDefinitionNode,
  TypeDefinitionNode,
  ScalarTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode,
  EnumTypeDefinitionNode,
  EnumValueDefinitionNode,
  InputObjectTypeDefinitionNode,
  TypeExtensionDefinitionNode,
  DirectiveDefinitionNode,
} from './language';


// Execute GraphQL queries.
export {
  execute,
  defaultFieldResolver,
  responsePathAsArray,
} from './execution';

export type {
  ExecutionResult,
} from './execution';


// Validate GraphQL queries.
export {
  validate,
  ValidationContext,
  specifiedRules,
} from './validation';


// Create and format GraphQL errors.
export {
  GraphQLError,
  formatError,
} from './error';

export type {
  GraphQLFormattedError,
  GraphQLErrorLocation,
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

  // Build a GraphQLSchema from a GraphQL schema language document.
  buildSchema,

  // Extends an existing GraphQLSchema from a parsed GraphQL Schema
  // language AST.
  extendSchema,

  // Print a GraphQLSchema to GraphQL Schema language.
  printSchema,

  // Print a GraphQLType to GraphQL Schema language.
  printType,

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

  // Separates an AST into an AST per Operation.
  separateOperations,

  // Comparators for types
  isEqualType,
  isTypeSubTypeOf,
  doTypesOverlap,

  // Asserts a string is a valid GraphQL name.
  assertValidName,

  // Compares two GraphQLSchemas and detects breaking changes.
  findBreakingChanges,
} from './utilities';

export type {
  BreakingChange,

  IntrospectionDirective,
  IntrospectionEnumType,
  IntrospectionEnumValue,
  IntrospectionField,
  IntrospectionInputObjectType,
  IntrospectionInputValue,
  IntrospectionInterfaceType,
  IntrospectionListTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionObjectType,
  IntrospectionQuery,
  IntrospectionScalarType,
  IntrospectionSchema,
  IntrospectionType,
  IntrospectionTypeRef,
  IntrospectionUnionType,
} from './utilities';
