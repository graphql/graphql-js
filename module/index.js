
export { graphql, graphqlSync } from './graphql';

// Create and operate on GraphQL type definitions and schema.
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
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
export { GraphQLSchema,
// Definitions
GraphQLScalarType, GraphQLObjectType, GraphQLInterfaceType, GraphQLUnionType, GraphQLEnumType, GraphQLInputObjectType, GraphQLList, GraphQLNonNull, GraphQLDirective,
// "Enum" of Type Kinds
TypeKind,
// Scalars
specifiedScalarTypes, GraphQLInt, GraphQLFloat, GraphQLString, GraphQLBoolean, GraphQLID,
// Built-in Directives defined by the Spec
specifiedDirectives, GraphQLIncludeDirective, GraphQLSkipDirective, GraphQLDeprecatedDirective,
// Constant Deprecation Reason
DEFAULT_DEPRECATION_REASON,
// Meta-field definitions.
SchemaMetaFieldDef, TypeMetaFieldDef, TypeNameMetaFieldDef,
// GraphQL Types for introspection.
introspectionTypes, __Schema, __Directive, __DirectiveLocation, __Type, __Field, __InputValue, __EnumValue, __TypeKind,
// Predicates
isSchema, isDirective, isType, isScalarType, isObjectType, isInterfaceType, isUnionType, isEnumType, isInputObjectType, isListType, isNonNullType, isInputType, isOutputType, isLeafType, isCompositeType, isAbstractType, isWrappingType, isNullableType, isNamedType, isSpecifiedScalarType, isIntrospectionType, isSpecifiedDirective,
// Assertions
assertType, assertScalarType, assertObjectType, assertInterfaceType, assertUnionType, assertEnumType, assertInputObjectType, assertListType, assertNonNullType, assertInputType, assertOutputType, assertLeafType, assertCompositeType, assertAbstractType, assertWrappingType, assertNullableType, assertNamedType,
// Un-modifiers
getNullableType, getNamedType,
// Validate GraphQL schema.
validateSchema, assertValidSchema } from './type';

// Parse and operate on GraphQL language source files.
export { Source, SourceLocation, getLocation,
// Parse
parse, parseValue, parseType,
// Print
print,
// Visit
visit, visitInParallel, visitWithTypeInfo, getVisitFn, Kind, TokenKind, DirectiveLocation, BREAK } from './language';

// Execute GraphQL queries.
export { execute, defaultFieldResolver, responsePathAsArray, getDirectiveValues } from './execution';

export { subscribe, createSourceEventStream } from './subscription';

// Validate GraphQL queries.
export { validate, ValidationContext,
// All validation rules in the GraphQL Specification.
specifiedRules,
// Individual validation rules.
FieldsOnCorrectTypeRule, FragmentsOnCompositeTypesRule, KnownArgumentNamesRule, KnownDirectivesRule, KnownFragmentNamesRule, KnownTypeNamesRule, LoneAnonymousOperationRule, NoFragmentCyclesRule, NoUndefinedVariablesRule, NoUnusedFragmentsRule, NoUnusedVariablesRule, OverlappingFieldsCanBeMergedRule, PossibleFragmentSpreadsRule, ProvidedNonNullArgumentsRule, ScalarLeafsRule, SingleFieldSubscriptionsRule, UniqueArgumentNamesRule, UniqueDirectivesPerLocationRule, UniqueFragmentNamesRule, UniqueInputFieldNamesRule, UniqueOperationNamesRule, UniqueVariableNamesRule, ValuesOfCorrectTypeRule, VariablesAreInputTypesRule, VariablesDefaultValueAllowedRule, VariablesInAllowedPositionRule } from './validation';

// Create, format, and print GraphQL errors.
export { GraphQLError, formatError, printError } from './error';

// Utilities for operating on GraphQL type schema and parsed sources.
export {
// Produce the GraphQL query recommended for a full schema introspection.
// Accepts optional IntrospectionOptions.
getIntrospectionQuery,
// Deprecated: use getIntrospectionQuery
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
// Prints the built-in introspection schema in the Schema Language
// format.
printIntrospectionSchema,
// Print a GraphQLType to GraphQL Schema language.
printType,
// Create a GraphQLType from a GraphQL language AST.
typeFromAST,
// Create a JavaScript value from a GraphQL language AST with a Type.
valueFromAST,
// Create a JavaScript value from a GraphQL language AST without a Type.
valueFromASTUntyped,
// Create a GraphQL language AST from a JavaScript value.
astFromValue,
// A helper to use within recursive-descent visitors which need to be aware of
// the GraphQL type system.
TypeInfo,
// Coerces a JavaScript value to a GraphQL type, or produces errors.
coerceValue,
// @deprecated use coerceValue
isValidJSValue,
// Determine if AST values adhere to a GraphQL type.
isValidLiteralValue,
// Concatenates multiple AST together.
concatAST,
// Separates an AST into an AST per Operation.
separateOperations,
// Comparators for types
isEqualType, isTypeSubTypeOf, doTypesOverlap,
// Asserts a string is a valid GraphQL name.
assertValidName,
// Compares two GraphQLSchemas and detects breaking changes.
findBreakingChanges, findDangerousChanges, BreakingChangeType, DangerousChangeType,
// Report all deprecated usage within a GraphQL document.
findDeprecatedUsages } from './utilities';