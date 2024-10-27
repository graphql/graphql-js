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
 * ```ts
 * import { parse } from 'graphql';
 * import { parse } from 'graphql/language';
 * ```
 *
 * @packageDocumentation
 */
export { version, versionInfo } from './version.js';
export type { GraphQLArgs } from './graphql.js';
export { graphql, graphqlSync } from './graphql.js';
export { resolveObjMapThunk, resolveReadonlyArrayThunk, GraphQLSchema, GraphQLDirective, GraphQLScalarType, GraphQLObjectType, GraphQLInterfaceType, GraphQLUnionType, GraphQLEnumType, GraphQLInputObjectType, GraphQLList, GraphQLNonNull, specifiedScalarTypes, GraphQLInt, GraphQLFloat, GraphQLString, GraphQLBoolean, GraphQLID, GRAPHQL_MAX_INT, GRAPHQL_MIN_INT, specifiedDirectives, GraphQLIncludeDirective, GraphQLSkipDirective, GraphQLDeferDirective, GraphQLStreamDirective, GraphQLDeprecatedDirective, GraphQLSpecifiedByDirective, GraphQLOneOfDirective, TypeKind, DEFAULT_DEPRECATION_REASON, introspectionTypes, __Schema, __Directive, __DirectiveLocation, __Type, __Field, __InputValue, __EnumValue, __TypeKind, SchemaMetaFieldDef, TypeMetaFieldDef, TypeNameMetaFieldDef, isSchema, isDirective, isType, isScalarType, isObjectType, isInterfaceType, isUnionType, isEnumType, isInputObjectType, isListType, isNonNullType, isInputType, isOutputType, isLeafType, isCompositeType, isAbstractType, isWrappingType, isNullableType, isNamedType, isRequiredArgument, isRequiredInputField, isSpecifiedScalarType, isIntrospectionType, isSpecifiedDirective, assertSchema, assertDirective, assertType, assertScalarType, assertObjectType, assertInterfaceType, assertUnionType, assertEnumType, assertInputObjectType, assertListType, assertNonNullType, assertInputType, assertOutputType, assertLeafType, assertCompositeType, assertAbstractType, assertWrappingType, assertNullableType, assertNamedType, getNullableType, getNamedType, validateSchema, assertValidSchema, assertName, assertEnumValueName, } from './type/index.js';
export type { GraphQLType, GraphQLInputType, GraphQLOutputType, GraphQLLeafType, GraphQLCompositeType, GraphQLAbstractType, GraphQLWrappingType, GraphQLNullableType, GraphQLNullableInputType, GraphQLNullableOutputType, GraphQLNamedType, GraphQLNamedInputType, GraphQLNamedOutputType, ThunkReadonlyArray, ThunkObjMap, GraphQLSchemaConfig, GraphQLSchemaExtensions, GraphQLDirectiveConfig, GraphQLDirectiveExtensions, GraphQLArgument, GraphQLArgumentConfig, GraphQLArgumentExtensions, GraphQLEnumTypeConfig, GraphQLEnumTypeExtensions, GraphQLEnumValue, GraphQLEnumValueConfig, GraphQLEnumValueConfigMap, GraphQLEnumValueExtensions, GraphQLField, GraphQLFieldConfig, GraphQLFieldConfigArgumentMap, GraphQLFieldConfigMap, GraphQLFieldExtensions, GraphQLFieldMap, GraphQLFieldResolver, GraphQLInputField, GraphQLInputFieldConfig, GraphQLInputFieldConfigMap, GraphQLInputFieldExtensions, GraphQLInputFieldMap, GraphQLInputObjectTypeConfig, GraphQLInputObjectTypeExtensions, GraphQLInterfaceTypeConfig, GraphQLInterfaceTypeExtensions, GraphQLIsTypeOfFn, GraphQLObjectTypeConfig, GraphQLObjectTypeExtensions, GraphQLResolveInfo, ResponsePath, GraphQLScalarTypeConfig, GraphQLScalarTypeExtensions, GraphQLTypeResolver, GraphQLUnionTypeConfig, GraphQLUnionTypeExtensions, GraphQLScalarSerializer, GraphQLScalarValueParser, GraphQLScalarLiteralParser, GraphQLScalarOutputValueCoercer, GraphQLScalarInputValueCoercer, GraphQLScalarInputLiteralCoercer, GraphQLDefaultValueUsage, } from './type/index.js';
export { Token, Source, Location, OperationTypeNode, getLocation, printLocation, printSourceLocation, Lexer, TokenKind, parse, parseValue, parseConstValue, parseType, print, visit, visitInParallel, getEnterLeaveForKind, BREAK, Kind, DirectiveLocation, isDefinitionNode, isExecutableDefinitionNode, isSelectionNode, isValueNode, isConstValueNode, isTypeNode, isTypeSystemDefinitionNode, isTypeDefinitionNode, isTypeSystemExtensionNode, isTypeExtensionNode, } from './language/index.js';
export type { ParseOptions, SourceLocation, ASTVisitor, ASTVisitFn, ASTVisitorKeyMap, ASTNode, ASTKindToNode, NameNode, DocumentNode, DefinitionNode, ExecutableDefinitionNode, OperationDefinitionNode, VariableDefinitionNode, VariableNode, SelectionSetNode, SelectionNode, FieldNode, ArgumentNode, FragmentArgumentNode, ConstArgumentNode, FragmentSpreadNode, InlineFragmentNode, FragmentDefinitionNode, ValueNode, ConstValueNode, IntValueNode, FloatValueNode, StringValueNode, BooleanValueNode, NullValueNode, EnumValueNode, ListValueNode, ConstListValueNode, ObjectValueNode, ConstObjectValueNode, ObjectFieldNode, ConstObjectFieldNode, DirectiveNode, ConstDirectiveNode, TypeNode, NamedTypeNode, ListTypeNode, NonNullTypeNode, TypeSystemDefinitionNode, SchemaDefinitionNode, OperationTypeDefinitionNode, TypeDefinitionNode, ScalarTypeDefinitionNode, ObjectTypeDefinitionNode, FieldDefinitionNode, InputValueDefinitionNode, InterfaceTypeDefinitionNode, UnionTypeDefinitionNode, EnumTypeDefinitionNode, EnumValueDefinitionNode, InputObjectTypeDefinitionNode, DirectiveDefinitionNode, TypeSystemExtensionNode, SchemaExtensionNode, TypeExtensionNode, ScalarTypeExtensionNode, ObjectTypeExtensionNode, InterfaceTypeExtensionNode, UnionTypeExtensionNode, EnumTypeExtensionNode, InputObjectTypeExtensionNode, } from './language/index.js';
export { execute, executeQueryOrMutationOrSubscriptionEvent, executeSubscriptionEvent, experimentalExecuteIncrementally, experimentalExecuteQueryOrMutationOrSubscriptionEvent, executeSync, defaultFieldResolver, defaultTypeResolver, responsePathAsArray, getArgumentValues, getVariableValues, getDirectiveValues, subscribe, createSourceEventStream, } from './execution/index.js';
export type { ExecutionArgs, ValidatedExecutionArgs, ExecutionResult, ExperimentalIncrementalExecutionResults, InitialIncrementalExecutionResult, SubsequentIncrementalExecutionResult, IncrementalDeferResult, IncrementalStreamResult, IncrementalResult, FormattedExecutionResult, FormattedInitialIncrementalExecutionResult, FormattedSubsequentIncrementalExecutionResult, FormattedIncrementalDeferResult, FormattedIncrementalStreamResult, FormattedIncrementalResult, } from './execution/index.js';
export { validate, ValidationContext, specifiedRules, recommendedRules, ExecutableDefinitionsRule, FieldsOnCorrectTypeRule, FragmentsOnCompositeTypesRule, KnownArgumentNamesRule, KnownDirectivesRule, KnownFragmentNamesRule, KnownTypeNamesRule, LoneAnonymousOperationRule, NoFragmentCyclesRule, NoUndefinedVariablesRule, NoUnusedFragmentsRule, NoUnusedVariablesRule, OverlappingFieldsCanBeMergedRule, PossibleFragmentSpreadsRule, ProvidedRequiredArgumentsRule, ScalarLeafsRule, SingleFieldSubscriptionsRule, UniqueArgumentNamesRule, UniqueDirectivesPerLocationRule, UniqueFragmentNamesRule, UniqueInputFieldNamesRule, UniqueOperationNamesRule, UniqueVariableNamesRule, ValuesOfCorrectTypeRule, VariablesAreInputTypesRule, VariablesInAllowedPositionRule, MaxIntrospectionDepthRule, LoneSchemaDefinitionRule, UniqueOperationTypesRule, UniqueTypeNamesRule, UniqueEnumValueNamesRule, UniqueFieldDefinitionNamesRule, UniqueArgumentDefinitionNamesRule, UniqueDirectiveNamesRule, PossibleTypeExtensionsRule, NoDeprecatedCustomRule, NoSchemaIntrospectionCustomRule, } from './validation/index.js';
export type { ValidationRule } from './validation/index.js';
export { GraphQLError, syntaxError, locatedError } from './error/index.js';
export type { GraphQLErrorOptions, GraphQLFormattedError, GraphQLErrorExtensions, } from './error/index.js';
export { getIntrospectionQuery, getOperationAST, introspectionFromSchema, buildClientSchema, buildASTSchema, buildSchema, extendSchema, lexicographicSortSchema, printSchema, printType, printDirective, printIntrospectionSchema, typeFromAST, 
/** @deprecated use `coerceInputLiteral()` instead - will be removed in v18 */
valueFromAST, valueFromASTUntyped, 
/** @deprecated use `valueToLiteral()` instead with care to operate on external values - `astFromValue()` will be removed in v18 */
astFromValue, TypeInfo, visitWithTypeInfo, replaceVariables, valueToLiteral, coerceInputValue, coerceInputLiteral, validateInputValue, validateInputLiteral, concatAST, separateOperations, stripIgnoredCharacters, isEqualType, isTypeSubTypeOf, doTypesOverlap, BreakingChangeType, DangerousChangeType, SafeChangeType, findBreakingChanges, findDangerousChanges, findSchemaChanges, } from './utilities/index.js';
export type { IntrospectionOptions, IntrospectionQuery, IntrospectionSchema, IntrospectionType, IntrospectionInputType, IntrospectionOutputType, IntrospectionScalarType, IntrospectionObjectType, IntrospectionInterfaceType, IntrospectionUnionType, IntrospectionEnumType, IntrospectionInputObjectType, IntrospectionTypeRef, IntrospectionInputTypeRef, IntrospectionOutputTypeRef, IntrospectionNamedTypeRef, IntrospectionListTypeRef, IntrospectionNonNullTypeRef, IntrospectionField, IntrospectionInputValue, IntrospectionEnumValue, IntrospectionDirective, BuildSchemaOptions, BreakingChange, SafeChange, DangerousChange, TypedQueryDocumentNode, } from './utilities/index.js';
