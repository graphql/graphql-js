"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isScalarType = exports.isType = exports.isDirective = exports.isSchema = exports.TypeNameMetaFieldDef = exports.TypeMetaFieldDef = exports.SchemaMetaFieldDef = exports.__TypeKind = exports.__EnumValue = exports.__InputValue = exports.__Field = exports.__Type = exports.__DirectiveLocation = exports.__Directive = exports.__Schema = exports.introspectionTypes = exports.DEFAULT_DEPRECATION_REASON = exports.TypeKind = exports.GraphQLOneOfDirective = exports.GraphQLSpecifiedByDirective = exports.GraphQLDeprecatedDirective = exports.GraphQLStreamDirective = exports.GraphQLDeferDirective = exports.GraphQLSkipDirective = exports.GraphQLIncludeDirective = exports.specifiedDirectives = exports.GRAPHQL_MIN_INT = exports.GRAPHQL_MAX_INT = exports.GraphQLID = exports.GraphQLBoolean = exports.GraphQLString = exports.GraphQLFloat = exports.GraphQLInt = exports.specifiedScalarTypes = exports.GraphQLNonNull = exports.GraphQLList = exports.GraphQLInputObjectType = exports.GraphQLEnumType = exports.GraphQLUnionType = exports.GraphQLInterfaceType = exports.GraphQLObjectType = exports.GraphQLScalarType = exports.GraphQLDirective = exports.GraphQLSchema = exports.resolveReadonlyArrayThunk = exports.resolveObjMapThunk = exports.graphqlSync = exports.graphql = exports.versionInfo = exports.version = void 0;
exports.validateSchema = exports.getNamedType = exports.getNullableType = exports.assertNamedType = exports.assertNullableType = exports.assertWrappingType = exports.assertAbstractType = exports.assertCompositeType = exports.assertLeafType = exports.assertOutputType = exports.assertInputType = exports.assertNonNullType = exports.assertListType = exports.assertInputField = exports.assertInputObjectType = exports.assertEnumValue = exports.assertEnumType = exports.assertUnionType = exports.assertInterfaceType = exports.assertArgument = exports.assertField = exports.assertObjectType = exports.assertScalarType = exports.assertType = exports.assertDirective = exports.assertSchema = exports.isSpecifiedDirective = exports.isIntrospectionType = exports.isSpecifiedScalarType = exports.isRequiredInputField = exports.isRequiredArgument = exports.isNamedType = exports.isNullableType = exports.isWrappingType = exports.isAbstractType = exports.isCompositeType = exports.isLeafType = exports.isOutputType = exports.isInputType = exports.isNonNullType = exports.isListType = exports.isInputField = exports.isInputObjectType = exports.isEnumValue = exports.isEnumType = exports.isUnionType = exports.isInterfaceType = exports.isArgument = exports.isField = exports.isObjectType = void 0;
exports.recommendedRules = exports.specifiedRules = exports.ValidationContext = exports.validate = exports.createSourceEventStream = exports.subscribe = exports.getDirectiveValues = exports.getVariableValues = exports.getArgumentValues = exports.responsePathAsArray = exports.defaultTypeResolver = exports.defaultFieldResolver = exports.executeSync = exports.experimentalExecuteQueryOrMutationOrSubscriptionEvent = exports.experimentalExecuteIncrementally = exports.executeSubscriptionEvent = exports.executeQueryOrMutationOrSubscriptionEvent = exports.execute = exports.isTypeExtensionNode = exports.isTypeSystemExtensionNode = exports.isTypeDefinitionNode = exports.isTypeSystemDefinitionNode = exports.isTypeNode = exports.isConstValueNode = exports.isValueNode = exports.isSelectionNode = exports.isExecutableDefinitionNode = exports.isDefinitionNode = exports.DirectiveLocation = exports.BREAK = exports.getEnterLeaveForKind = exports.visitInParallel = exports.visit = exports.parseType = exports.parseConstValue = exports.parseValue = exports.parse = exports.TokenKind = exports.Lexer = exports.printSourceLocation = exports.printLocation = exports.getLocation = exports.OperationTypeNode = exports.Location = exports.Source = exports.Token = exports.Kind = exports.assertEnumValueName = exports.assertName = exports.assertValidSchema = void 0;
exports.printSchema = exports.lexicographicSortSchema = exports.extendSchema = exports.buildSchema = exports.buildASTSchema = exports.buildClientSchema = exports.introspectionFromSchema = exports.getOperationAST = exports.getIntrospectionQuery = exports.locatedError = exports.syntaxError = exports.GraphQLError = exports.NoSchemaIntrospectionCustomRule = exports.NoDeprecatedCustomRule = exports.PossibleTypeExtensionsRule = exports.UniqueDirectiveNamesRule = exports.UniqueArgumentDefinitionNamesRule = exports.UniqueFieldDefinitionNamesRule = exports.UniqueEnumValueNamesRule = exports.UniqueTypeNamesRule = exports.UniqueOperationTypesRule = exports.LoneSchemaDefinitionRule = exports.MaxIntrospectionDepthRule = exports.VariablesInAllowedPositionRule = exports.VariablesAreInputTypesRule = exports.ValuesOfCorrectTypeRule = exports.UniqueVariableNamesRule = exports.UniqueOperationNamesRule = exports.UniqueInputFieldNamesRule = exports.UniqueFragmentNamesRule = exports.UniqueDirectivesPerLocationRule = exports.UniqueArgumentNamesRule = exports.SingleFieldSubscriptionsRule = exports.ScalarLeafsRule = exports.ProvidedRequiredArgumentsRule = exports.PossibleFragmentSpreadsRule = exports.OverlappingFieldsCanBeMergedRule = exports.NoUnusedVariablesRule = exports.NoUnusedFragmentsRule = exports.NoUndefinedVariablesRule = exports.NoFragmentCyclesRule = exports.LoneAnonymousOperationRule = exports.KnownTypeNamesRule = exports.KnownOperationTypesRule = exports.KnownFragmentNamesRule = exports.KnownDirectivesRule = exports.KnownArgumentNamesRule = exports.FragmentsOnCompositeTypesRule = exports.FieldsOnCorrectTypeRule = exports.ExecutableDefinitionsRule = void 0;
exports.findSchemaChanges = exports.findDangerousChanges = exports.findBreakingChanges = exports.SafeChangeType = exports.DangerousChangeType = exports.BreakingChangeType = exports.doTypesOverlap = exports.isTypeSubTypeOf = exports.isEqualType = exports.stripIgnoredCharacters = exports.separateOperations = exports.concatAST = exports.validateInputLiteral = exports.validateInputValue = exports.coerceInputLiteral = exports.coerceInputValue = exports.valueToLiteral = exports.replaceVariables = exports.visitWithTypeInfo = exports.TypeInfo = exports.astFromValue = exports.valueFromASTUntyped = exports.valueFromAST = exports.typeFromAST = exports.printIntrospectionSchema = exports.printDirective = exports.printType = void 0;
// The GraphQL.js version info.
var version_js_1 = require("./version.js");
Object.defineProperty(exports, "version", { enumerable: true, get: function () { return version_js_1.version; } });
Object.defineProperty(exports, "versionInfo", { enumerable: true, get: function () { return version_js_1.versionInfo; } });
var graphql_js_1 = require("./graphql.js");
Object.defineProperty(exports, "graphql", { enumerable: true, get: function () { return graphql_js_1.graphql; } });
Object.defineProperty(exports, "graphqlSync", { enumerable: true, get: function () { return graphql_js_1.graphqlSync; } });
var index_js_1 = require("./type/index.js");
Object.defineProperty(exports, "resolveObjMapThunk", { enumerable: true, get: function () { return index_js_1.resolveObjMapThunk; } });
Object.defineProperty(exports, "resolveReadonlyArrayThunk", { enumerable: true, get: function () { return index_js_1.resolveReadonlyArrayThunk; } });
// Definitions
Object.defineProperty(exports, "GraphQLSchema", { enumerable: true, get: function () { return index_js_1.GraphQLSchema; } });
Object.defineProperty(exports, "GraphQLDirective", { enumerable: true, get: function () { return index_js_1.GraphQLDirective; } });
Object.defineProperty(exports, "GraphQLScalarType", { enumerable: true, get: function () { return index_js_1.GraphQLScalarType; } });
Object.defineProperty(exports, "GraphQLObjectType", { enumerable: true, get: function () { return index_js_1.GraphQLObjectType; } });
Object.defineProperty(exports, "GraphQLInterfaceType", { enumerable: true, get: function () { return index_js_1.GraphQLInterfaceType; } });
Object.defineProperty(exports, "GraphQLUnionType", { enumerable: true, get: function () { return index_js_1.GraphQLUnionType; } });
Object.defineProperty(exports, "GraphQLEnumType", { enumerable: true, get: function () { return index_js_1.GraphQLEnumType; } });
Object.defineProperty(exports, "GraphQLInputObjectType", { enumerable: true, get: function () { return index_js_1.GraphQLInputObjectType; } });
Object.defineProperty(exports, "GraphQLList", { enumerable: true, get: function () { return index_js_1.GraphQLList; } });
Object.defineProperty(exports, "GraphQLNonNull", { enumerable: true, get: function () { return index_js_1.GraphQLNonNull; } });
// Standard GraphQL Scalars
Object.defineProperty(exports, "specifiedScalarTypes", { enumerable: true, get: function () { return index_js_1.specifiedScalarTypes; } });
Object.defineProperty(exports, "GraphQLInt", { enumerable: true, get: function () { return index_js_1.GraphQLInt; } });
Object.defineProperty(exports, "GraphQLFloat", { enumerable: true, get: function () { return index_js_1.GraphQLFloat; } });
Object.defineProperty(exports, "GraphQLString", { enumerable: true, get: function () { return index_js_1.GraphQLString; } });
Object.defineProperty(exports, "GraphQLBoolean", { enumerable: true, get: function () { return index_js_1.GraphQLBoolean; } });
Object.defineProperty(exports, "GraphQLID", { enumerable: true, get: function () { return index_js_1.GraphQLID; } });
// Int boundaries constants
Object.defineProperty(exports, "GRAPHQL_MAX_INT", { enumerable: true, get: function () { return index_js_1.GRAPHQL_MAX_INT; } });
Object.defineProperty(exports, "GRAPHQL_MIN_INT", { enumerable: true, get: function () { return index_js_1.GRAPHQL_MIN_INT; } });
// Built-in Directives defined by the Spec
Object.defineProperty(exports, "specifiedDirectives", { enumerable: true, get: function () { return index_js_1.specifiedDirectives; } });
Object.defineProperty(exports, "GraphQLIncludeDirective", { enumerable: true, get: function () { return index_js_1.GraphQLIncludeDirective; } });
Object.defineProperty(exports, "GraphQLSkipDirective", { enumerable: true, get: function () { return index_js_1.GraphQLSkipDirective; } });
Object.defineProperty(exports, "GraphQLDeferDirective", { enumerable: true, get: function () { return index_js_1.GraphQLDeferDirective; } });
Object.defineProperty(exports, "GraphQLStreamDirective", { enumerable: true, get: function () { return index_js_1.GraphQLStreamDirective; } });
Object.defineProperty(exports, "GraphQLDeprecatedDirective", { enumerable: true, get: function () { return index_js_1.GraphQLDeprecatedDirective; } });
Object.defineProperty(exports, "GraphQLSpecifiedByDirective", { enumerable: true, get: function () { return index_js_1.GraphQLSpecifiedByDirective; } });
Object.defineProperty(exports, "GraphQLOneOfDirective", { enumerable: true, get: function () { return index_js_1.GraphQLOneOfDirective; } });
// "Enum" of Type Kinds
Object.defineProperty(exports, "TypeKind", { enumerable: true, get: function () { return index_js_1.TypeKind; } });
// Constant Deprecation Reason
Object.defineProperty(exports, "DEFAULT_DEPRECATION_REASON", { enumerable: true, get: function () { return index_js_1.DEFAULT_DEPRECATION_REASON; } });
// GraphQL Types for introspection.
Object.defineProperty(exports, "introspectionTypes", { enumerable: true, get: function () { return index_js_1.introspectionTypes; } });
Object.defineProperty(exports, "__Schema", { enumerable: true, get: function () { return index_js_1.__Schema; } });
Object.defineProperty(exports, "__Directive", { enumerable: true, get: function () { return index_js_1.__Directive; } });
Object.defineProperty(exports, "__DirectiveLocation", { enumerable: true, get: function () { return index_js_1.__DirectiveLocation; } });
Object.defineProperty(exports, "__Type", { enumerable: true, get: function () { return index_js_1.__Type; } });
Object.defineProperty(exports, "__Field", { enumerable: true, get: function () { return index_js_1.__Field; } });
Object.defineProperty(exports, "__InputValue", { enumerable: true, get: function () { return index_js_1.__InputValue; } });
Object.defineProperty(exports, "__EnumValue", { enumerable: true, get: function () { return index_js_1.__EnumValue; } });
Object.defineProperty(exports, "__TypeKind", { enumerable: true, get: function () { return index_js_1.__TypeKind; } });
// Meta-field definitions.
Object.defineProperty(exports, "SchemaMetaFieldDef", { enumerable: true, get: function () { return index_js_1.SchemaMetaFieldDef; } });
Object.defineProperty(exports, "TypeMetaFieldDef", { enumerable: true, get: function () { return index_js_1.TypeMetaFieldDef; } });
Object.defineProperty(exports, "TypeNameMetaFieldDef", { enumerable: true, get: function () { return index_js_1.TypeNameMetaFieldDef; } });
// Predicates
Object.defineProperty(exports, "isSchema", { enumerable: true, get: function () { return index_js_1.isSchema; } });
Object.defineProperty(exports, "isDirective", { enumerable: true, get: function () { return index_js_1.isDirective; } });
Object.defineProperty(exports, "isType", { enumerable: true, get: function () { return index_js_1.isType; } });
Object.defineProperty(exports, "isScalarType", { enumerable: true, get: function () { return index_js_1.isScalarType; } });
Object.defineProperty(exports, "isObjectType", { enumerable: true, get: function () { return index_js_1.isObjectType; } });
Object.defineProperty(exports, "isField", { enumerable: true, get: function () { return index_js_1.isField; } });
Object.defineProperty(exports, "isArgument", { enumerable: true, get: function () { return index_js_1.isArgument; } });
Object.defineProperty(exports, "isInterfaceType", { enumerable: true, get: function () { return index_js_1.isInterfaceType; } });
Object.defineProperty(exports, "isUnionType", { enumerable: true, get: function () { return index_js_1.isUnionType; } });
Object.defineProperty(exports, "isEnumType", { enumerable: true, get: function () { return index_js_1.isEnumType; } });
Object.defineProperty(exports, "isEnumValue", { enumerable: true, get: function () { return index_js_1.isEnumValue; } });
Object.defineProperty(exports, "isInputObjectType", { enumerable: true, get: function () { return index_js_1.isInputObjectType; } });
Object.defineProperty(exports, "isInputField", { enumerable: true, get: function () { return index_js_1.isInputField; } });
Object.defineProperty(exports, "isListType", { enumerable: true, get: function () { return index_js_1.isListType; } });
Object.defineProperty(exports, "isNonNullType", { enumerable: true, get: function () { return index_js_1.isNonNullType; } });
Object.defineProperty(exports, "isInputType", { enumerable: true, get: function () { return index_js_1.isInputType; } });
Object.defineProperty(exports, "isOutputType", { enumerable: true, get: function () { return index_js_1.isOutputType; } });
Object.defineProperty(exports, "isLeafType", { enumerable: true, get: function () { return index_js_1.isLeafType; } });
Object.defineProperty(exports, "isCompositeType", { enumerable: true, get: function () { return index_js_1.isCompositeType; } });
Object.defineProperty(exports, "isAbstractType", { enumerable: true, get: function () { return index_js_1.isAbstractType; } });
Object.defineProperty(exports, "isWrappingType", { enumerable: true, get: function () { return index_js_1.isWrappingType; } });
Object.defineProperty(exports, "isNullableType", { enumerable: true, get: function () { return index_js_1.isNullableType; } });
Object.defineProperty(exports, "isNamedType", { enumerable: true, get: function () { return index_js_1.isNamedType; } });
Object.defineProperty(exports, "isRequiredArgument", { enumerable: true, get: function () { return index_js_1.isRequiredArgument; } });
Object.defineProperty(exports, "isRequiredInputField", { enumerable: true, get: function () { return index_js_1.isRequiredInputField; } });
Object.defineProperty(exports, "isSpecifiedScalarType", { enumerable: true, get: function () { return index_js_1.isSpecifiedScalarType; } });
Object.defineProperty(exports, "isIntrospectionType", { enumerable: true, get: function () { return index_js_1.isIntrospectionType; } });
Object.defineProperty(exports, "isSpecifiedDirective", { enumerable: true, get: function () { return index_js_1.isSpecifiedDirective; } });
// Assertions
Object.defineProperty(exports, "assertSchema", { enumerable: true, get: function () { return index_js_1.assertSchema; } });
Object.defineProperty(exports, "assertDirective", { enumerable: true, get: function () { return index_js_1.assertDirective; } });
Object.defineProperty(exports, "assertType", { enumerable: true, get: function () { return index_js_1.assertType; } });
Object.defineProperty(exports, "assertScalarType", { enumerable: true, get: function () { return index_js_1.assertScalarType; } });
Object.defineProperty(exports, "assertObjectType", { enumerable: true, get: function () { return index_js_1.assertObjectType; } });
Object.defineProperty(exports, "assertField", { enumerable: true, get: function () { return index_js_1.assertField; } });
Object.defineProperty(exports, "assertArgument", { enumerable: true, get: function () { return index_js_1.assertArgument; } });
Object.defineProperty(exports, "assertInterfaceType", { enumerable: true, get: function () { return index_js_1.assertInterfaceType; } });
Object.defineProperty(exports, "assertUnionType", { enumerable: true, get: function () { return index_js_1.assertUnionType; } });
Object.defineProperty(exports, "assertEnumType", { enumerable: true, get: function () { return index_js_1.assertEnumType; } });
Object.defineProperty(exports, "assertEnumValue", { enumerable: true, get: function () { return index_js_1.assertEnumValue; } });
Object.defineProperty(exports, "assertInputObjectType", { enumerable: true, get: function () { return index_js_1.assertInputObjectType; } });
Object.defineProperty(exports, "assertInputField", { enumerable: true, get: function () { return index_js_1.assertInputField; } });
Object.defineProperty(exports, "assertListType", { enumerable: true, get: function () { return index_js_1.assertListType; } });
Object.defineProperty(exports, "assertNonNullType", { enumerable: true, get: function () { return index_js_1.assertNonNullType; } });
Object.defineProperty(exports, "assertInputType", { enumerable: true, get: function () { return index_js_1.assertInputType; } });
Object.defineProperty(exports, "assertOutputType", { enumerable: true, get: function () { return index_js_1.assertOutputType; } });
Object.defineProperty(exports, "assertLeafType", { enumerable: true, get: function () { return index_js_1.assertLeafType; } });
Object.defineProperty(exports, "assertCompositeType", { enumerable: true, get: function () { return index_js_1.assertCompositeType; } });
Object.defineProperty(exports, "assertAbstractType", { enumerable: true, get: function () { return index_js_1.assertAbstractType; } });
Object.defineProperty(exports, "assertWrappingType", { enumerable: true, get: function () { return index_js_1.assertWrappingType; } });
Object.defineProperty(exports, "assertNullableType", { enumerable: true, get: function () { return index_js_1.assertNullableType; } });
Object.defineProperty(exports, "assertNamedType", { enumerable: true, get: function () { return index_js_1.assertNamedType; } });
// Un-modifiers
Object.defineProperty(exports, "getNullableType", { enumerable: true, get: function () { return index_js_1.getNullableType; } });
Object.defineProperty(exports, "getNamedType", { enumerable: true, get: function () { return index_js_1.getNamedType; } });
// Validate GraphQL schema.
Object.defineProperty(exports, "validateSchema", { enumerable: true, get: function () { return index_js_1.validateSchema; } });
Object.defineProperty(exports, "assertValidSchema", { enumerable: true, get: function () { return index_js_1.assertValidSchema; } });
// Upholds the spec rules about naming.
Object.defineProperty(exports, "assertName", { enumerable: true, get: function () { return index_js_1.assertName; } });
Object.defineProperty(exports, "assertEnumValueName", { enumerable: true, get: function () { return index_js_1.assertEnumValueName; } });
// Parse and operate on GraphQL language source files.
// @see https://github.com/typescript-eslint/typescript-eslint/issues/10313
// eslint-disable-next-line @typescript-eslint/consistent-type-exports
var kinds_js_1 = require("./language/kinds.js");
Object.defineProperty(exports, "Kind", { enumerable: true, get: function () { return kinds_js_1.Kind; } });
var index_js_2 = require("./language/index.js");
Object.defineProperty(exports, "Token", { enumerable: true, get: function () { return index_js_2.Token; } });
Object.defineProperty(exports, "Source", { enumerable: true, get: function () { return index_js_2.Source; } });
Object.defineProperty(exports, "Location", { enumerable: true, get: function () { return index_js_2.Location; } });
Object.defineProperty(exports, "OperationTypeNode", { enumerable: true, get: function () { return index_js_2.OperationTypeNode; } });
Object.defineProperty(exports, "getLocation", { enumerable: true, get: function () { return index_js_2.getLocation; } });
// Print source location.
Object.defineProperty(exports, "printLocation", { enumerable: true, get: function () { return index_js_2.printLocation; } });
Object.defineProperty(exports, "printSourceLocation", { enumerable: true, get: function () { return index_js_2.printSourceLocation; } });
// Lex
Object.defineProperty(exports, "Lexer", { enumerable: true, get: function () { return index_js_2.Lexer; } });
Object.defineProperty(exports, "TokenKind", { enumerable: true, get: function () { return index_js_2.TokenKind; } });
// Parse
Object.defineProperty(exports, "parse", { enumerable: true, get: function () { return index_js_2.parse; } });
Object.defineProperty(exports, "parseValue", { enumerable: true, get: function () { return index_js_2.parseValue; } });
Object.defineProperty(exports, "parseConstValue", { enumerable: true, get: function () { return index_js_2.parseConstValue; } });
Object.defineProperty(exports, "parseType", { enumerable: true, get: function () { return index_js_2.parseType; } });
// Print
Object.defineProperty(exports, "print", { enumerable: true, get: function () { return index_js_2.print; } });
// Visit
Object.defineProperty(exports, "visit", { enumerable: true, get: function () { return index_js_2.visit; } });
Object.defineProperty(exports, "visitInParallel", { enumerable: true, get: function () { return index_js_2.visitInParallel; } });
Object.defineProperty(exports, "getEnterLeaveForKind", { enumerable: true, get: function () { return index_js_2.getEnterLeaveForKind; } });
Object.defineProperty(exports, "BREAK", { enumerable: true, get: function () { return index_js_2.BREAK; } });
Object.defineProperty(exports, "DirectiveLocation", { enumerable: true, get: function () { return index_js_2.DirectiveLocation; } });
// Predicates
Object.defineProperty(exports, "isDefinitionNode", { enumerable: true, get: function () { return index_js_2.isDefinitionNode; } });
Object.defineProperty(exports, "isExecutableDefinitionNode", { enumerable: true, get: function () { return index_js_2.isExecutableDefinitionNode; } });
Object.defineProperty(exports, "isSelectionNode", { enumerable: true, get: function () { return index_js_2.isSelectionNode; } });
Object.defineProperty(exports, "isValueNode", { enumerable: true, get: function () { return index_js_2.isValueNode; } });
Object.defineProperty(exports, "isConstValueNode", { enumerable: true, get: function () { return index_js_2.isConstValueNode; } });
Object.defineProperty(exports, "isTypeNode", { enumerable: true, get: function () { return index_js_2.isTypeNode; } });
Object.defineProperty(exports, "isTypeSystemDefinitionNode", { enumerable: true, get: function () { return index_js_2.isTypeSystemDefinitionNode; } });
Object.defineProperty(exports, "isTypeDefinitionNode", { enumerable: true, get: function () { return index_js_2.isTypeDefinitionNode; } });
Object.defineProperty(exports, "isTypeSystemExtensionNode", { enumerable: true, get: function () { return index_js_2.isTypeSystemExtensionNode; } });
Object.defineProperty(exports, "isTypeExtensionNode", { enumerable: true, get: function () { return index_js_2.isTypeExtensionNode; } });
// Execute GraphQL queries.
var index_js_3 = require("./execution/index.js");
Object.defineProperty(exports, "execute", { enumerable: true, get: function () { return index_js_3.execute; } });
Object.defineProperty(exports, "executeQueryOrMutationOrSubscriptionEvent", { enumerable: true, get: function () { return index_js_3.executeQueryOrMutationOrSubscriptionEvent; } });
Object.defineProperty(exports, "executeSubscriptionEvent", { enumerable: true, get: function () { return index_js_3.executeSubscriptionEvent; } });
Object.defineProperty(exports, "experimentalExecuteIncrementally", { enumerable: true, get: function () { return index_js_3.experimentalExecuteIncrementally; } });
Object.defineProperty(exports, "experimentalExecuteQueryOrMutationOrSubscriptionEvent", { enumerable: true, get: function () { return index_js_3.experimentalExecuteQueryOrMutationOrSubscriptionEvent; } });
Object.defineProperty(exports, "executeSync", { enumerable: true, get: function () { return index_js_3.executeSync; } });
Object.defineProperty(exports, "defaultFieldResolver", { enumerable: true, get: function () { return index_js_3.defaultFieldResolver; } });
Object.defineProperty(exports, "defaultTypeResolver", { enumerable: true, get: function () { return index_js_3.defaultTypeResolver; } });
Object.defineProperty(exports, "responsePathAsArray", { enumerable: true, get: function () { return index_js_3.responsePathAsArray; } });
Object.defineProperty(exports, "getArgumentValues", { enumerable: true, get: function () { return index_js_3.getArgumentValues; } });
Object.defineProperty(exports, "getVariableValues", { enumerable: true, get: function () { return index_js_3.getVariableValues; } });
Object.defineProperty(exports, "getDirectiveValues", { enumerable: true, get: function () { return index_js_3.getDirectiveValues; } });
Object.defineProperty(exports, "subscribe", { enumerable: true, get: function () { return index_js_3.subscribe; } });
Object.defineProperty(exports, "createSourceEventStream", { enumerable: true, get: function () { return index_js_3.createSourceEventStream; } });
// Validate GraphQL documents.
var index_js_4 = require("./validation/index.js");
Object.defineProperty(exports, "validate", { enumerable: true, get: function () { return index_js_4.validate; } });
Object.defineProperty(exports, "ValidationContext", { enumerable: true, get: function () { return index_js_4.ValidationContext; } });
// All validation rules in the GraphQL Specification.
Object.defineProperty(exports, "specifiedRules", { enumerable: true, get: function () { return index_js_4.specifiedRules; } });
Object.defineProperty(exports, "recommendedRules", { enumerable: true, get: function () { return index_js_4.recommendedRules; } });
// Individual validation rules.
Object.defineProperty(exports, "ExecutableDefinitionsRule", { enumerable: true, get: function () { return index_js_4.ExecutableDefinitionsRule; } });
Object.defineProperty(exports, "FieldsOnCorrectTypeRule", { enumerable: true, get: function () { return index_js_4.FieldsOnCorrectTypeRule; } });
Object.defineProperty(exports, "FragmentsOnCompositeTypesRule", { enumerable: true, get: function () { return index_js_4.FragmentsOnCompositeTypesRule; } });
Object.defineProperty(exports, "KnownArgumentNamesRule", { enumerable: true, get: function () { return index_js_4.KnownArgumentNamesRule; } });
Object.defineProperty(exports, "KnownDirectivesRule", { enumerable: true, get: function () { return index_js_4.KnownDirectivesRule; } });
Object.defineProperty(exports, "KnownFragmentNamesRule", { enumerable: true, get: function () { return index_js_4.KnownFragmentNamesRule; } });
Object.defineProperty(exports, "KnownOperationTypesRule", { enumerable: true, get: function () { return index_js_4.KnownOperationTypesRule; } });
Object.defineProperty(exports, "KnownTypeNamesRule", { enumerable: true, get: function () { return index_js_4.KnownTypeNamesRule; } });
Object.defineProperty(exports, "LoneAnonymousOperationRule", { enumerable: true, get: function () { return index_js_4.LoneAnonymousOperationRule; } });
Object.defineProperty(exports, "NoFragmentCyclesRule", { enumerable: true, get: function () { return index_js_4.NoFragmentCyclesRule; } });
Object.defineProperty(exports, "NoUndefinedVariablesRule", { enumerable: true, get: function () { return index_js_4.NoUndefinedVariablesRule; } });
Object.defineProperty(exports, "NoUnusedFragmentsRule", { enumerable: true, get: function () { return index_js_4.NoUnusedFragmentsRule; } });
Object.defineProperty(exports, "NoUnusedVariablesRule", { enumerable: true, get: function () { return index_js_4.NoUnusedVariablesRule; } });
Object.defineProperty(exports, "OverlappingFieldsCanBeMergedRule", { enumerable: true, get: function () { return index_js_4.OverlappingFieldsCanBeMergedRule; } });
Object.defineProperty(exports, "PossibleFragmentSpreadsRule", { enumerable: true, get: function () { return index_js_4.PossibleFragmentSpreadsRule; } });
Object.defineProperty(exports, "ProvidedRequiredArgumentsRule", { enumerable: true, get: function () { return index_js_4.ProvidedRequiredArgumentsRule; } });
Object.defineProperty(exports, "ScalarLeafsRule", { enumerable: true, get: function () { return index_js_4.ScalarLeafsRule; } });
Object.defineProperty(exports, "SingleFieldSubscriptionsRule", { enumerable: true, get: function () { return index_js_4.SingleFieldSubscriptionsRule; } });
Object.defineProperty(exports, "UniqueArgumentNamesRule", { enumerable: true, get: function () { return index_js_4.UniqueArgumentNamesRule; } });
Object.defineProperty(exports, "UniqueDirectivesPerLocationRule", { enumerable: true, get: function () { return index_js_4.UniqueDirectivesPerLocationRule; } });
Object.defineProperty(exports, "UniqueFragmentNamesRule", { enumerable: true, get: function () { return index_js_4.UniqueFragmentNamesRule; } });
Object.defineProperty(exports, "UniqueInputFieldNamesRule", { enumerable: true, get: function () { return index_js_4.UniqueInputFieldNamesRule; } });
Object.defineProperty(exports, "UniqueOperationNamesRule", { enumerable: true, get: function () { return index_js_4.UniqueOperationNamesRule; } });
Object.defineProperty(exports, "UniqueVariableNamesRule", { enumerable: true, get: function () { return index_js_4.UniqueVariableNamesRule; } });
Object.defineProperty(exports, "ValuesOfCorrectTypeRule", { enumerable: true, get: function () { return index_js_4.ValuesOfCorrectTypeRule; } });
Object.defineProperty(exports, "VariablesAreInputTypesRule", { enumerable: true, get: function () { return index_js_4.VariablesAreInputTypesRule; } });
Object.defineProperty(exports, "VariablesInAllowedPositionRule", { enumerable: true, get: function () { return index_js_4.VariablesInAllowedPositionRule; } });
Object.defineProperty(exports, "MaxIntrospectionDepthRule", { enumerable: true, get: function () { return index_js_4.MaxIntrospectionDepthRule; } });
// SDL-specific validation rules
Object.defineProperty(exports, "LoneSchemaDefinitionRule", { enumerable: true, get: function () { return index_js_4.LoneSchemaDefinitionRule; } });
Object.defineProperty(exports, "UniqueOperationTypesRule", { enumerable: true, get: function () { return index_js_4.UniqueOperationTypesRule; } });
Object.defineProperty(exports, "UniqueTypeNamesRule", { enumerable: true, get: function () { return index_js_4.UniqueTypeNamesRule; } });
Object.defineProperty(exports, "UniqueEnumValueNamesRule", { enumerable: true, get: function () { return index_js_4.UniqueEnumValueNamesRule; } });
Object.defineProperty(exports, "UniqueFieldDefinitionNamesRule", { enumerable: true, get: function () { return index_js_4.UniqueFieldDefinitionNamesRule; } });
Object.defineProperty(exports, "UniqueArgumentDefinitionNamesRule", { enumerable: true, get: function () { return index_js_4.UniqueArgumentDefinitionNamesRule; } });
Object.defineProperty(exports, "UniqueDirectiveNamesRule", { enumerable: true, get: function () { return index_js_4.UniqueDirectiveNamesRule; } });
Object.defineProperty(exports, "PossibleTypeExtensionsRule", { enumerable: true, get: function () { return index_js_4.PossibleTypeExtensionsRule; } });
// Custom validation rules
Object.defineProperty(exports, "NoDeprecatedCustomRule", { enumerable: true, get: function () { return index_js_4.NoDeprecatedCustomRule; } });
Object.defineProperty(exports, "NoSchemaIntrospectionCustomRule", { enumerable: true, get: function () { return index_js_4.NoSchemaIntrospectionCustomRule; } });
// Create, format, and print GraphQL errors.
var index_js_5 = require("./error/index.js");
Object.defineProperty(exports, "GraphQLError", { enumerable: true, get: function () { return index_js_5.GraphQLError; } });
Object.defineProperty(exports, "syntaxError", { enumerable: true, get: function () { return index_js_5.syntaxError; } });
Object.defineProperty(exports, "locatedError", { enumerable: true, get: function () { return index_js_5.locatedError; } });
// Utilities for operating on GraphQL type schema and parsed sources.
var index_js_6 = require("./utilities/index.js");
// Produce the GraphQL query recommended for a full schema introspection.
// Accepts optional IntrospectionOptions.
Object.defineProperty(exports, "getIntrospectionQuery", { enumerable: true, get: function () { return index_js_6.getIntrospectionQuery; } });
// Gets the target Operation from a Document.
Object.defineProperty(exports, "getOperationAST", { enumerable: true, get: function () { return index_js_6.getOperationAST; } });
// Convert a GraphQLSchema to an IntrospectionQuery.
Object.defineProperty(exports, "introspectionFromSchema", { enumerable: true, get: function () { return index_js_6.introspectionFromSchema; } });
// Build a GraphQLSchema from an introspection result.
Object.defineProperty(exports, "buildClientSchema", { enumerable: true, get: function () { return index_js_6.buildClientSchema; } });
// Build a GraphQLSchema from a parsed GraphQL Schema language AST.
Object.defineProperty(exports, "buildASTSchema", { enumerable: true, get: function () { return index_js_6.buildASTSchema; } });
// Build a GraphQLSchema from a GraphQL schema language document.
Object.defineProperty(exports, "buildSchema", { enumerable: true, get: function () { return index_js_6.buildSchema; } });
// Extends an existing GraphQLSchema from a parsed GraphQL Schema language AST.
Object.defineProperty(exports, "extendSchema", { enumerable: true, get: function () { return index_js_6.extendSchema; } });
// Sort a GraphQLSchema.
Object.defineProperty(exports, "lexicographicSortSchema", { enumerable: true, get: function () { return index_js_6.lexicographicSortSchema; } });
// Print a GraphQLSchema to GraphQL Schema language.
Object.defineProperty(exports, "printSchema", { enumerable: true, get: function () { return index_js_6.printSchema; } });
// Print a GraphQLType to GraphQL Schema language.
Object.defineProperty(exports, "printType", { enumerable: true, get: function () { return index_js_6.printType; } });
// Print a GraphQLDirective to GraphQL Schema language.
Object.defineProperty(exports, "printDirective", { enumerable: true, get: function () { return index_js_6.printDirective; } });
// Prints the built-in introspection schema in the Schema Language format.
Object.defineProperty(exports, "printIntrospectionSchema", { enumerable: true, get: function () { return index_js_6.printIntrospectionSchema; } });
// Create a GraphQLType from a GraphQL language AST.
Object.defineProperty(exports, "typeFromAST", { enumerable: true, get: function () { return index_js_6.typeFromAST; } });
// Create a JavaScript value from a GraphQL language AST with a Type.
/** @deprecated use `coerceInputLiteral()` instead - will be removed in v18 */
Object.defineProperty(exports, "valueFromAST", { enumerable: true, get: function () { return index_js_6.valueFromAST; } });
// Create a JavaScript value from a GraphQL language AST without a Type.
Object.defineProperty(exports, "valueFromASTUntyped", { enumerable: true, get: function () { return index_js_6.valueFromASTUntyped; } });
// Create a GraphQL language AST from a JavaScript value.
/** @deprecated use `valueToLiteral()` instead with care to operate on external values - `astFromValue()` will be removed in v18 */
Object.defineProperty(exports, "astFromValue", { enumerable: true, get: function () { return index_js_6.astFromValue; } });
// A helper to use within recursive-descent visitors which need to be aware of the GraphQL type system.
Object.defineProperty(exports, "TypeInfo", { enumerable: true, get: function () { return index_js_6.TypeInfo; } });
Object.defineProperty(exports, "visitWithTypeInfo", { enumerable: true, get: function () { return index_js_6.visitWithTypeInfo; } });
// Converts a value to a const value by replacing variables.
Object.defineProperty(exports, "replaceVariables", { enumerable: true, get: function () { return index_js_6.replaceVariables; } });
// Create a GraphQL literal (AST) from a JavaScript input value.
Object.defineProperty(exports, "valueToLiteral", { enumerable: true, get: function () { return index_js_6.valueToLiteral; } });
// Coerces a JavaScript value to a GraphQL type, or returns undefined.
Object.defineProperty(exports, "coerceInputValue", { enumerable: true, get: function () { return index_js_6.coerceInputValue; } });
// Coerces a GraphQL literal (AST) to a GraphQL type, or returns undefined.
Object.defineProperty(exports, "coerceInputLiteral", { enumerable: true, get: function () { return index_js_6.coerceInputLiteral; } });
// Validate a JavaScript value with a GraphQL type, collecting all errors.
Object.defineProperty(exports, "validateInputValue", { enumerable: true, get: function () { return index_js_6.validateInputValue; } });
// Validate a GraphQL literal (AST) with a GraphQL type, collecting all errors.
Object.defineProperty(exports, "validateInputLiteral", { enumerable: true, get: function () { return index_js_6.validateInputLiteral; } });
// Concatenates multiple AST together.
Object.defineProperty(exports, "concatAST", { enumerable: true, get: function () { return index_js_6.concatAST; } });
// Separates an AST into an AST per Operation.
Object.defineProperty(exports, "separateOperations", { enumerable: true, get: function () { return index_js_6.separateOperations; } });
// Strips characters that are not significant to the validity or execution of a GraphQL document.
Object.defineProperty(exports, "stripIgnoredCharacters", { enumerable: true, get: function () { return index_js_6.stripIgnoredCharacters; } });
// Comparators for types
Object.defineProperty(exports, "isEqualType", { enumerable: true, get: function () { return index_js_6.isEqualType; } });
Object.defineProperty(exports, "isTypeSubTypeOf", { enumerable: true, get: function () { return index_js_6.isTypeSubTypeOf; } });
Object.defineProperty(exports, "doTypesOverlap", { enumerable: true, get: function () { return index_js_6.doTypesOverlap; } });
// Compares two GraphQLSchemas and detects breaking changes.
Object.defineProperty(exports, "BreakingChangeType", { enumerable: true, get: function () { return index_js_6.BreakingChangeType; } });
Object.defineProperty(exports, "DangerousChangeType", { enumerable: true, get: function () { return index_js_6.DangerousChangeType; } });
Object.defineProperty(exports, "SafeChangeType", { enumerable: true, get: function () { return index_js_6.SafeChangeType; } });
Object.defineProperty(exports, "findBreakingChanges", { enumerable: true, get: function () { return index_js_6.findBreakingChanges; } });
Object.defineProperty(exports, "findDangerousChanges", { enumerable: true, get: function () { return index_js_6.findDangerousChanges; } });
Object.defineProperty(exports, "findSchemaChanges", { enumerable: true, get: function () { return index_js_6.findSchemaChanges; } });
//# sourceMappingURL=index.js.map