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
 * import { parse } from 'https://deno.land/x/graphql@16.3.0/mod.ts';
 * import { parse } from 'https://deno.land/x/graphql_language@16.3.0/mod.ts';
 * ```
 *
 * @packageDocumentation
 */
// The GraphQL.js version info.
export { version, versionInfo } from './version.ts'; // The primary entry point into fulfilling a GraphQL request.

export type { GraphQLArgs } from './graphql.ts';
export { graphql, graphqlSync } from './graphql.ts'; // Create and operate on GraphQL type definitions and schema.

export {
  __Directive,
  __DirectiveLocation,
  __EnumValue,
  __Field,
  __InputValue,
  __Schema,
  __Type,
  __TypeKind, // Meta-field definitions.
  assertAbstractType,
  assertCompositeType,
  assertDirective,
  assertEnumType,
  assertEnumValueName,
  assertInputObjectType,
  assertInputType,
  assertInterfaceType,
  assertLeafType,
  assertListType,
  assertName,
  assertNamedType, // Un-modifiers
  assertNonNullType,
  assertNullableType,
  assertObjectType,
  assertOutputType,
  assertScalarType,
  assertSchema,
  assertType,
  assertUnionType,
  assertValidSchema, // Upholds the spec rules about naming.
  assertWrappingType,
  DEFAULT_DEPRECATION_REASON, // GraphQL Types for introspection.
  getNamedType, // Validate GraphQL schema.
  getNullableType,
  GRAPHQL_MAX_INT,
  GRAPHQL_MIN_INT, // Built-in Directives defined by the Spec
  GraphQLBoolean,
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLID, // Int boundaries constants
  GraphQLIncludeDirective,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull, // Standard GraphQL Scalars
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLSkipDirective,
  GraphQLSpecifiedByDirective, // "Enum" of Type Kinds
  GraphQLString,
  GraphQLUnionType,
  introspectionTypes,
  isAbstractType,
  isCompositeType,
  isDirective,
  isEnumType,
  isInputObjectType,
  isInputType,
  isInterfaceType,
  isIntrospectionType,
  isLeafType,
  isListType,
  isNamedType,
  isNonNullType,
  isNullableType,
  isObjectType,
  isOutputType,
  isRequiredArgument,
  isRequiredInputField,
  isScalarType,
  isSchema,
  isSpecifiedDirective, // Assertions
  isSpecifiedScalarType,
  isType,
  isUnionType,
  isWrappingType,
  resolveObjMapThunk,
  resolveReadonlyArrayThunk, // Definitions
  SchemaMetaFieldDef,
  specifiedDirectives,
  specifiedScalarTypes,
  TypeKind, // Constant Deprecation Reason
  TypeMetaFieldDef,
  TypeNameMetaFieldDef, // Predicates
  validateSchema,
} from './type/index.ts';
export type {
  GraphQLAbstractType,
  GraphQLArgument,
  GraphQLArgumentConfig,
  GraphQLArgumentExtensions,
  GraphQLCompositeType,
  GraphQLDirectiveConfig,
  GraphQLDirectiveExtensions,
  GraphQLEnumTypeConfig,
  GraphQLEnumTypeExtensions,
  GraphQLEnumValue,
  GraphQLEnumValueConfig,
  GraphQLEnumValueConfigMap,
  GraphQLEnumValueExtensions,
  GraphQLField,
  GraphQLFieldConfig,
  GraphQLFieldConfigArgumentMap,
  GraphQLFieldConfigMap,
  GraphQLFieldExtensions,
  GraphQLFieldMap,
  GraphQLFieldResolver,
  GraphQLInputField,
  GraphQLInputFieldConfig,
  GraphQLInputFieldConfigMap,
  GraphQLInputFieldExtensions,
  GraphQLInputFieldMap,
  GraphQLInputObjectTypeConfig,
  GraphQLInputObjectTypeExtensions,
  GraphQLInputType,
  GraphQLInterfaceTypeConfig,
  GraphQLInterfaceTypeExtensions,
  GraphQLIsTypeOfFn,
  GraphQLLeafType,
  GraphQLNamedInputType,
  GraphQLNamedOutputType,
  GraphQLNamedType,
  GraphQLNullableType,
  GraphQLObjectTypeConfig,
  GraphQLObjectTypeExtensions,
  GraphQLOutputType,
  GraphQLResolveInfo,
  GraphQLScalarLiteralParser,
  GraphQLScalarSerializer,
  GraphQLScalarTypeConfig,
  GraphQLScalarTypeExtensions,
  GraphQLScalarValueParser,
  GraphQLSchemaConfig,
  GraphQLSchemaExtensions,
  GraphQLType,
  GraphQLTypeResolver,
  GraphQLUnionTypeConfig,
  GraphQLUnionTypeExtensions,
  GraphQLWrappingType,
  ResponsePath,
  ThunkObjMap,
  ThunkReadonlyArray,
} from './type/index.ts'; // Parse and operate on GraphQL language source files.

export {
  BREAK,
  DirectiveLocation, // Predicates
  getEnterLeaveForKind,
  getLocation, // Print source location.
  getVisitFn,
  isConstValueNode,
  isDefinitionNode,
  isExecutableDefinitionNode,
  isSelectionNode,
  isTypeDefinitionNode,
  isTypeExtensionNode,
  isTypeNode,
  isTypeSystemDefinitionNode,
  isTypeSystemExtensionNode,
  isValueNode,
  Kind,
  Lexer,
  Location,
  OperationTypeNode,
  parse,
  parseConstValue,
  parseType, // Print
  parseValue,
  print, // Visit
  printLocation,
  printSourceLocation, // Lex
  Source,
  Token,
  TokenKind, // Parse
  visit,
  visitInParallel,
} from './language/index.ts';
export type {
  ArgumentNode,
  ASTKindToNode, // Each kind of AST node
  ASTNode,
  ASTVisitFn,
  ASTVisitor,
  ASTVisitorKeyMap, // AST nodes
  BooleanValueNode,
  ConstArgumentNode,
  ConstDirectiveNode,
  ConstListValueNode,
  ConstObjectFieldNode,
  ConstObjectValueNode,
  ConstValueNode,
  DefinitionNode,
  DirectiveDefinitionNode,
  DirectiveLocationEnum, // Visitor utilities
  DirectiveNode,
  DocumentNode,
  EnumTypeDefinitionNode,
  EnumTypeExtensionNode,
  EnumValueDefinitionNode,
  EnumValueNode,
  ExecutableDefinitionNode,
  FieldDefinitionNode,
  FieldNode,
  FloatValueNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  IntValueNode,
  KindEnum,
  ListTypeNode,
  ListValueNode,
  NamedTypeNode,
  NameNode,
  NonNullTypeNode,
  NullValueNode,
  ObjectFieldNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  ObjectValueNode,
  OperationDefinitionNode,
  OperationTypeDefinitionNode,
  ParseOptions,
  ScalarTypeDefinitionNode,
  ScalarTypeExtensionNode,
  SchemaDefinitionNode,
  SchemaExtensionNode,
  SelectionNode,
  SelectionSetNode,
  SourceLocation,
  StringValueNode,
  TokenKindEnum,
  TypeDefinitionNode,
  TypeExtensionNode,
  TypeNode,
  TypeSystemDefinitionNode,
  TypeSystemExtensionNode,
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
  ValueNode,
  VariableDefinitionNode,
  VariableNode,
} from './language/index.ts'; // Execute GraphQL queries.

export {
  createSourceEventStream,
  defaultFieldResolver,
  defaultTypeResolver,
  execute,
  executeSync,
  getArgumentValues,
  getDirectiveValues,
  getVariableValues,
  responsePathAsArray,
  subscribe,
} from './execution/index.ts';
export type {
  ExecutionArgs,
  ExecutionResult,
  FormattedExecutionResult,
} from './execution/index.ts';
export type { SubscriptionArgs } from './subscription/index.ts'; // Validate GraphQL documents.

export {
  ExecutableDefinitionsRule,
  FieldsOnCorrectTypeRule,
  FragmentsOnCompositeTypesRule,
  KnownArgumentNamesRule,
  KnownDirectivesRule,
  KnownFragmentNamesRule,
  KnownTypeNamesRule,
  LoneAnonymousOperationRule,
  LoneSchemaDefinitionRule,
  NoDeprecatedCustomRule,
  NoFragmentCyclesRule,
  NoSchemaIntrospectionCustomRule,
  NoUndefinedVariablesRule,
  NoUnusedFragmentsRule,
  NoUnusedVariablesRule,
  OverlappingFieldsCanBeMergedRule,
  PossibleFragmentSpreadsRule,
  PossibleTypeExtensionsRule, // Custom validation rules
  ProvidedRequiredArgumentsRule,
  ScalarLeafsRule,
  SingleFieldSubscriptionsRule,
  specifiedRules, // Individual validation rules.
  UniqueArgumentDefinitionNamesRule,
  UniqueArgumentNamesRule,
  UniqueDirectiveNamesRule,
  UniqueDirectivesPerLocationRule,
  UniqueEnumValueNamesRule,
  UniqueFieldDefinitionNamesRule,
  UniqueFragmentNamesRule,
  UniqueInputFieldNamesRule,
  UniqueOperationNamesRule,
  UniqueOperationTypesRule,
  UniqueTypeNamesRule,
  UniqueVariableNamesRule,
  validate,
  ValidationContext, // All validation rules in the GraphQL Specification.
  ValuesOfCorrectTypeRule,
  VariablesAreInputTypesRule,
  VariablesInAllowedPositionRule, // SDL-specific validation rules
} from './validation/index.ts';
export type { ValidationRule } from './validation/index.ts'; // Create, format, and print GraphQL errors.

export {
  formatError,
  GraphQLError,
  locatedError,
  printError,
  syntaxError,
} from './error/index.ts';
export type {
  GraphQLErrorExtensions,
  GraphQLFormattedError,
} from './error/index.ts'; // Utilities for operating on GraphQL type schema and parsed sources.

export {
  assertValidName, // Determine if a string is a valid GraphQL name.
  astFromValue, // A helper to use within recursive-descent visitors which need to be aware of the GraphQL type system.
  BreakingChangeType,
  buildASTSchema, // Build a GraphQLSchema from a GraphQL schema language document.
  buildClientSchema, // Build a GraphQLSchema from a parsed GraphQL Schema language AST.
  buildSchema, // Extends an existing GraphQLSchema from a parsed GraphQL Schema language AST.
  coerceInputValue, // Concatenates multiple AST together.
  concatAST, // Separates an AST into an AST per Operation.
  DangerousChangeType,
  doTypesOverlap, // Asserts a string is a valid GraphQL name.
  extendSchema, // Sort a GraphQLSchema.
  findBreakingChanges,
  findDangerousChanges,
  // Produce the GraphQL query recommended for a full schema introspection.
  // Accepts optional IntrospectionOptions.
  getIntrospectionQuery, // Gets the target Operation from a Document.
  getOperationAST, // Gets the Type for the target Operation AST.
  getOperationRootType, // Convert a GraphQLSchema to an IntrospectionQuery.
  introspectionFromSchema, // Build a GraphQLSchema from an introspection result.
  isEqualType,
  isTypeSubTypeOf,
  isValidNameError, // Compares two GraphQLSchemas and detects breaking changes.
  lexicographicSortSchema, // Print a GraphQLSchema to GraphQL Schema language.
  printIntrospectionSchema, // Create a GraphQLType from a GraphQL language AST.
  printSchema, // Print a GraphQLType to GraphQL Schema language.
  printType, // Prints the built-in introspection schema in the Schema Language format.
  separateOperations, // Strips characters that are not significant to the validity or execution of a GraphQL document.
  stripIgnoredCharacters, // Comparators for types
  typeFromAST, // Create a JavaScript value from a GraphQL language AST with a Type.
  TypeInfo,
  valueFromAST, // Create a JavaScript value from a GraphQL language AST without a Type.
  valueFromASTUntyped, // Create a GraphQL language AST from a JavaScript value.
  visitWithTypeInfo, // Coerces a JavaScript value to a GraphQL type, or produces errors.
} from './utilities/index.ts';
export type {
  BreakingChange,
  BuildSchemaOptions,
  DangerousChange,
  IntrospectionDirective,
  IntrospectionEnumType,
  IntrospectionEnumValue,
  IntrospectionField,
  IntrospectionInputObjectType,
  IntrospectionInputType,
  IntrospectionInputTypeRef,
  IntrospectionInputValue,
  IntrospectionInterfaceType,
  IntrospectionListTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionObjectType,
  IntrospectionOptions,
  IntrospectionOutputType,
  IntrospectionOutputTypeRef,
  IntrospectionQuery,
  IntrospectionScalarType,
  IntrospectionSchema,
  IntrospectionType,
  IntrospectionTypeRef,
  IntrospectionUnionType,
  TypedQueryDocumentNode,
} from './utilities/index.ts';
