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

// The GraphQL.js version info.
export { version, versionInfo } from './version.js';

// The primary entry point into fulfilling a GraphQL request.
export type { GraphQLArgs } from './graphql.js';
export { graphql, graphqlSync } from './graphql.js';

// Create and operate on GraphQL type definitions and schema.
export type {
  GraphQLField,
  GraphQLArgument,
  GraphQLEnumValue,
  GraphQLInputField,
} from './type/index.js';
export {
  resolveObjMapThunk,
  resolveReadonlyArrayThunk,
  // Definitions
  GraphQLSchema,
  GraphQLDirective,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  // Standard GraphQL Scalars
  specifiedScalarTypes,
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLID,
  // Int boundaries constants
  GRAPHQL_MAX_INT,
  GRAPHQL_MIN_INT,
  // Built-in Directives defined by the Spec
  specifiedDirectives,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLDeferDirective,
  GraphQLStreamDirective,
  GraphQLDeprecatedDirective,
  GraphQLSpecifiedByDirective,
  GraphQLOneOfDirective,
  // "Enum" of Type Kinds
  TypeKind,
  // Constant Deprecation Reason
  DEFAULT_DEPRECATION_REASON,
  // GraphQL Types for introspection.
  introspectionTypes,
  __Schema,
  __Directive,
  __DirectiveLocation,
  __Type,
  __Field,
  __InputValue,
  __EnumValue,
  __TypeKind,
  // Meta-field definitions.
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
  // Predicates
  isSchema,
  isDirective,
  isType,
  isScalarType,
  isObjectType,
  isField,
  isArgument,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isEnumValue,
  isInputObjectType,
  isInputField,
  isListType,
  isNonNullType,
  isInputType,
  isOutputType,
  isLeafType,
  isCompositeType,
  isAbstractType,
  isWrappingType,
  isNullableType,
  isNamedType,
  isRequiredArgument,
  isRequiredInputField,
  isSpecifiedScalarType,
  isIntrospectionType,
  isSpecifiedDirective,
  // Assertions
  assertSchema,
  assertDirective,
  assertType,
  assertScalarType,
  assertObjectType,
  assertField,
  assertArgument,
  assertInterfaceType,
  assertUnionType,
  assertEnumType,
  assertEnumValue,
  assertInputObjectType,
  assertInputField,
  assertListType,
  assertNonNullType,
  assertInputType,
  assertOutputType,
  assertLeafType,
  assertCompositeType,
  assertAbstractType,
  assertWrappingType,
  assertNullableType,
  assertNamedType,
  // Un-modifiers
  getNullableType,
  getNamedType,
  // Validate GraphQL schema.
  validateSchema,
  assertValidSchema,
  // Upholds the spec rules about naming.
  assertName,
  assertEnumValueName,
} from './type/index.js';

export type {
  GraphQLType,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLLeafType,
  GraphQLCompositeType,
  GraphQLAbstractType,
  GraphQLWrappingType,
  GraphQLNullableType,
  GraphQLNullableInputType,
  GraphQLNullableOutputType,
  GraphQLNamedType,
  GraphQLNamedInputType,
  GraphQLNamedOutputType,
  ThunkReadonlyArray,
  ThunkObjMap,
  GraphQLSchemaConfig,
  GraphQLSchemaExtensions,
  GraphQLDirectiveConfig,
  GraphQLDirectiveExtensions,
  GraphQLArgumentConfig,
  GraphQLArgumentExtensions,
  GraphQLEnumTypeConfig,
  GraphQLEnumTypeExtensions,
  GraphQLEnumValueConfig,
  GraphQLEnumValueConfigMap,
  GraphQLEnumValueExtensions,
  GraphQLFieldConfig,
  GraphQLFieldConfigArgumentMap,
  GraphQLFieldConfigMap,
  GraphQLFieldExtensions,
  GraphQLFieldMap,
  GraphQLFieldResolver,
  GraphQLInputFieldConfig,
  GraphQLInputFieldConfigMap,
  GraphQLInputFieldExtensions,
  GraphQLInputFieldMap,
  GraphQLInputObjectTypeConfig,
  GraphQLInputObjectTypeExtensions,
  GraphQLInterfaceTypeConfig,
  GraphQLInterfaceTypeExtensions,
  GraphQLIsTypeOfFn,
  GraphQLObjectTypeConfig,
  GraphQLObjectTypeExtensions,
  GraphQLResolveInfo,
  ResponsePath,
  GraphQLScalarTypeConfig,
  GraphQLScalarTypeExtensions,
  GraphQLTypeResolver,
  GraphQLUnionTypeConfig,
  GraphQLUnionTypeExtensions,
  GraphQLScalarSerializer,
  GraphQLScalarValueParser,
  GraphQLScalarLiteralParser,
  GraphQLScalarOutputValueCoercer,
  GraphQLScalarInputValueCoercer,
  GraphQLScalarInputLiteralCoercer,
  GraphQLDefaultInput,
} from './type/index.js';

// Parse and operate on GraphQL language source files.
// @see https://github.com/typescript-eslint/typescript-eslint/issues/10313
// eslint-disable-next-line @typescript-eslint/consistent-type-exports
export { Kind } from './language/kinds.js';
export {
  Token,
  Source,
  Location,
  OperationTypeNode,
  getLocation,
  // Print source location.
  printLocation,
  printSourceLocation,
  // Lex
  Lexer,
  TokenKind,
  // Parse
  parse,
  parseValue,
  parseConstValue,
  parseType,
  // Print
  print,
  // Visit
  visit,
  visitInParallel,
  getEnterLeaveForKind,
  BREAK,
  DirectiveLocation,
  // Predicates
  isDefinitionNode,
  isExecutableDefinitionNode,
  isSelectionNode,
  isValueNode,
  isConstValueNode,
  isTypeNode,
  isTypeSystemDefinitionNode,
  isTypeDefinitionNode,
  isTypeSystemExtensionNode,
  isTypeExtensionNode,
} from './language/index.js';

export type {
  ParseOptions,
  SourceLocation,
  // Visitor utilities
  ASTVisitor,
  ASTVisitFn,
  ASTVisitorKeyMap,
  // AST nodes
  ASTNode,
  ASTKindToNode,
  // Each kind of AST node
  NameNode,
  DocumentNode,
  DefinitionNode,
  ExecutableDefinitionNode,
  OperationDefinitionNode,
  VariableDefinitionNode,
  VariableNode,
  SelectionSetNode,
  SelectionNode,
  FieldNode,
  ArgumentNode,
  FragmentArgumentNode,
  ConstArgumentNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
  ValueNode,
  ConstValueNode,
  IntValueNode,
  FloatValueNode,
  StringValueNode,
  BooleanValueNode,
  NullValueNode,
  EnumValueNode,
  ListValueNode,
  ConstListValueNode,
  ObjectValueNode,
  ConstObjectValueNode,
  ObjectFieldNode,
  ConstObjectFieldNode,
  DirectiveNode,
  ConstDirectiveNode,
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
  DirectiveDefinitionNode,
  TypeSystemExtensionNode,
  SchemaExtensionNode,
  TypeExtensionNode,
  ScalarTypeExtensionNode,
  ObjectTypeExtensionNode,
  InterfaceTypeExtensionNode,
  UnionTypeExtensionNode,
  EnumTypeExtensionNode,
  InputObjectTypeExtensionNode,
} from './language/index.js';

// Execute GraphQL queries.
export {
  execute,
  executeQueryOrMutationOrSubscriptionEvent,
  executeSubscriptionEvent,
  experimentalExecuteIncrementally,
  experimentalExecuteQueryOrMutationOrSubscriptionEvent,
  executeSync,
  defaultFieldResolver,
  defaultTypeResolver,
  responsePathAsArray,
  getArgumentValues,
  getVariableValues,
  getDirectiveValues,
  subscribe,
  createSourceEventStream,
} from './execution/index.js';

export type {
  ExecutionArgs,
  ValidatedExecutionArgs,
  ExecutionResult,
  ExperimentalIncrementalExecutionResults,
  InitialIncrementalExecutionResult,
  SubsequentIncrementalExecutionResult,
  IncrementalDeferResult,
  IncrementalStreamResult,
  IncrementalResult,
  FormattedExecutionResult,
  FormattedInitialIncrementalExecutionResult,
  FormattedSubsequentIncrementalExecutionResult,
  FormattedIncrementalDeferResult,
  FormattedIncrementalStreamResult,
  FormattedIncrementalResult,
} from './execution/index.js';

// Validate GraphQL documents.
export {
  validate,
  ValidationContext,
  // All validation rules in the GraphQL Specification.
  specifiedRules,
  recommendedRules,
  // Individual validation rules.
  ExecutableDefinitionsRule,
  FieldsOnCorrectTypeRule,
  FragmentsOnCompositeTypesRule,
  KnownArgumentNamesRule,
  KnownDirectivesRule,
  KnownFragmentNamesRule,
  KnownOperationTypesRule,
  KnownTypeNamesRule,
  LoneAnonymousOperationRule,
  NoFragmentCyclesRule,
  NoUndefinedVariablesRule,
  NoUnusedFragmentsRule,
  NoUnusedVariablesRule,
  OverlappingFieldsCanBeMergedRule,
  PossibleFragmentSpreadsRule,
  ProvidedRequiredArgumentsRule,
  ScalarLeafsRule,
  SingleFieldSubscriptionsRule,
  UniqueArgumentNamesRule,
  UniqueDirectivesPerLocationRule,
  UniqueFragmentNamesRule,
  UniqueInputFieldNamesRule,
  UniqueOperationNamesRule,
  UniqueVariableNamesRule,
  ValuesOfCorrectTypeRule,
  VariablesAreInputTypesRule,
  VariablesInAllowedPositionRule,
  MaxIntrospectionDepthRule,
  // SDL-specific validation rules
  LoneSchemaDefinitionRule,
  UniqueOperationTypesRule,
  UniqueTypeNamesRule,
  UniqueEnumValueNamesRule,
  UniqueFieldDefinitionNamesRule,
  UniqueArgumentDefinitionNamesRule,
  UniqueDirectiveNamesRule,
  PossibleTypeExtensionsRule,
  // Custom validation rules
  NoDeprecatedCustomRule,
  NoSchemaIntrospectionCustomRule,
} from './validation/index.js';

export type { ValidationRule } from './validation/index.js';

// Create, format, and print GraphQL errors.
export { GraphQLError, syntaxError, locatedError } from './error/index.js';

export type {
  GraphQLErrorOptions,
  GraphQLFormattedError,
  GraphQLErrorExtensions,
  GraphQLFormattedErrorExtensions,
} from './error/index.js';

// Utilities for operating on GraphQL type schema and parsed sources.
export {
  // Produce the GraphQL query recommended for a full schema introspection.
  // Accepts optional IntrospectionOptions.
  getIntrospectionQuery,
  // Gets the target Operation from a Document.
  getOperationAST,
  // Convert a GraphQLSchema to an IntrospectionQuery.
  introspectionFromSchema,
  // Build a GraphQLSchema from an introspection result.
  buildClientSchema,
  // Build a GraphQLSchema from a parsed GraphQL Schema language AST.
  buildASTSchema,
  // Build a GraphQLSchema from a GraphQL schema language document.
  buildSchema,
  // Extends an existing GraphQLSchema from a parsed GraphQL Schema language AST.
  extendSchema,
  // Sort a GraphQLSchema.
  lexicographicSortSchema,
  // Print a GraphQLSchema to GraphQL Schema language.
  printSchema,
  // Print a GraphQLType to GraphQL Schema language.
  printType,
  // Print a GraphQLDirective to GraphQL Schema language.
  printDirective,
  // Prints the built-in introspection schema in the Schema Language format.
  printIntrospectionSchema,
  // Create a GraphQLType from a GraphQL language AST.
  typeFromAST,
  // Create a JavaScript value from a GraphQL language AST with a Type.
  /** @deprecated use `coerceInputLiteral()` instead - will be removed in v18 */
  valueFromAST,
  // Create a JavaScript value from a GraphQL language AST without a Type.
  valueFromASTUntyped,
  // Create a GraphQL language AST from a JavaScript value.
  /** @deprecated use `valueToLiteral()` instead with care to operate on external values - `astFromValue()` will be removed in v18 */
  astFromValue,
  // A helper to use within recursive-descent visitors which need to be aware of the GraphQL type system.
  TypeInfo,
  visitWithTypeInfo,
  // Converts a value to a const value by replacing variables.
  replaceVariables,
  // Create a GraphQL literal (AST) from a JavaScript input value.
  valueToLiteral,
  // Coerces a JavaScript value to a GraphQL type, or returns undefined.
  coerceInputValue,
  // Coerces a GraphQL literal (AST) to a GraphQL type, or returns undefined.
  coerceInputLiteral,
  // Validate a JavaScript value with a GraphQL type, collecting all errors.
  validateInputValue,
  // Validate a GraphQL literal (AST) with a GraphQL type, collecting all errors.
  validateInputLiteral,
  // Concatenates multiple AST together.
  concatAST,
  // Separates an AST into an AST per Operation.
  separateOperations,
  // Strips characters that are not significant to the validity or execution of a GraphQL document.
  stripIgnoredCharacters,
  // Comparators for types
  isEqualType,
  isTypeSubTypeOf,
  doTypesOverlap,
  // Compares two GraphQLSchemas and detects breaking changes.
  BreakingChangeType,
  DangerousChangeType,
  SafeChangeType,
  findBreakingChanges,
  findDangerousChanges,
  findSchemaChanges,
} from './utilities/index.js';

export type {
  IntrospectionOptions,
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
  BuildSchemaOptions,
  BreakingChange,
  SafeChange,
  DangerousChange,
  TypedQueryDocumentNode,
} from './utilities/index.js';
