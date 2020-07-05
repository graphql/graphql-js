// Minimum TypeScript Version: 2.6

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

// The GraphQL.js version info.
export { version, versionInfo } from './version';

// The primary entry point into fulfilling a GraphQL request.
export { GraphQLArgs, graphql, graphqlSync } from './graphql';

// Create and operate on GraphQL type definitions and schema.
export {
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
  // Built-in Directives defined by the Spec
  specifiedDirectives,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLDeprecatedDirective,
  GraphQLSpecifiedByDirective,
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
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
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
  assertInterfaceType,
  assertUnionType,
  assertEnumType,
  assertInputObjectType,
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
} from './type/index';

export {
  GraphQLType,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLLeafType,
  GraphQLCompositeType,
  GraphQLAbstractType,
  GraphQLWrappingType,
  GraphQLNullableType,
  GraphQLNamedType,
  Thunk,
  GraphQLSchemaConfig,
  GraphQLSchemaExtensions,
  GraphQLDirectiveConfig,
  GraphQLDirectiveExtensions,
  GraphQLArgument,
  GraphQLArgumentConfig,
  GraphQLArgumentExtensions,
  GraphQLEnumTypeConfig,
  GraphQLEnumTypeExtensions,
  GraphQLEnumValue,
  GraphQLEnumValueConfig,
  GraphQLEnumValueExtensions,
  GraphQLEnumValueConfigMap,
  GraphQLField,
  GraphQLFieldConfig,
  GraphQLFieldExtensions,
  GraphQLFieldConfigArgumentMap,
  GraphQLFieldConfigMap,
  GraphQLFieldMap,
  GraphQLFieldResolver,
  GraphQLInputField,
  GraphQLInputFieldConfig,
  GraphQLInputFieldExtensions,
  GraphQLInputFieldConfigMap,
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
} from './type/index';

// Parse and operate on GraphQL language source files.
export {
  Token,
  Source,
  Location,
  getLocation,
  // Print source location
  printLocation,
  printSourceLocation,
  // Lex
  Lexer,
  TokenKind,
  // Parse
  parse,
  parseValue,
  parseType,
  // Print
  print,
  // Visit
  visit,
  visitInParallel,
  getVisitFn,
  BREAK,
  Kind,
  DirectiveLocation,
  // Predicates
  isDefinitionNode,
  isExecutableDefinitionNode,
  isSelectionNode,
  isValueNode,
  isTypeNode,
  isTypeSystemDefinitionNode,
  isTypeDefinitionNode,
  isTypeSystemExtensionNode,
  isTypeExtensionNode,
} from './language/index';

export {
  ParseOptions,
  SourceLocation,
  TokenKindEnum,
  KindEnum,
  DirectiveLocationEnum,
  // Visitor utilities
  ASTVisitor,
  Visitor,
  VisitFn,
  VisitorKeyMap,
  // AST nodes
  ASTNode,
  ASTKindToNode,
  // Each kind of AST node
  NameNode,
  DocumentNode,
  DefinitionNode,
  ExecutableDefinitionNode,
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
} from './language/index';

// Execute GraphQL queries.
export {
  execute,
  executeSync,
  defaultFieldResolver,
  defaultTypeResolver,
  responsePathAsArray,
  getDirectiveValues,
  ExecutionArgs,
  ExecutionResult,
  FormattedExecutionResult,
} from './execution/index';

export {
  subscribe,
  createSourceEventStream,
  SubscriptionArgs,
} from './subscription/index';

// Validate GraphQL documents.
export {
  validate,
  ValidationContext,
  // All validation rules in the GraphQL Specification.
  specifiedRules,
  // Individual validation rules.
  ExecutableDefinitionsRule,
  FieldsOnCorrectTypeRule,
  FragmentsOnCompositeTypesRule,
  KnownArgumentNamesRule,
  KnownDirectivesRule,
  KnownFragmentNamesRule,
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
  // SDL-specific validation rules
  LoneSchemaDefinitionRule,
  UniqueOperationTypesRule,
  UniqueTypeNamesRule,
  UniqueEnumValueNamesRule,
  UniqueFieldDefinitionNamesRule,
  UniqueDirectiveNamesRule,
  PossibleTypeExtensionsRule,
  // Custom validation rules
  NoDeprecatedCustomRule,
  NoSchemaIntrospectionCustomRule,
  ValidationRule,
} from './validation/index';

// Create, format, and print GraphQL errors.
export {
  GraphQLError,
  syntaxError,
  locatedError,
  printError,
  formatError,
  GraphQLFormattedError,
} from './error/index';

// Utilities for operating on GraphQL type schema and parsed sources.
export {
  // Produce the GraphQL query recommended for a full schema introspection.
  // Accepts optional IntrospectionOptions.
  getIntrospectionQuery,
  // Gets the target Operation from a Document.
  getOperationAST,
  // Gets the Type for the target Operation AST.
  getOperationRootType,
  // Convert a GraphQLSchema to an IntrospectionQuery.
  introspectionFromSchema,
  // Build a GraphQLSchema from an introspection result.
  buildClientSchema,
  // Build a GraphQLSchema from a parsed GraphQL Schema language AST.
  buildASTSchema,
  // Build a GraphQLSchema from a GraphQL schema language document.
  buildSchema,
  // @deprecated: Get the description from a schema AST node and supports legacy
  // syntax for specifying descriptions - will be removed in v16.
  getDescription,
  // Extends an existing GraphQLSchema from a parsed GraphQL Schema
  // language AST.
  extendSchema,
  // Sort a GraphQLSchema.
  lexicographicSortSchema,
  // Print a GraphQLSchema to GraphQL Schema language.
  printSchema,
  // Print a GraphQLType to GraphQL Schema language.
  printType,
  // Prints the built-in introspection schema in the Schema Language
  // format.
  printIntrospectionSchema,
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
  visitWithTypeInfo,
  // Coerces a JavaScript value to a GraphQL type, or produces errors.
  coerceInputValue,
  // Concatenates multiple AST together.
  concatAST,
  // Separates an AST into an AST per Operation.
  separateOperations,
  // Strips characters that are not significant to the validity or execution
  // of a GraphQL document.
  stripIgnoredCharacters,
  // Comparators for types
  isEqualType,
  isTypeSubTypeOf,
  doTypesOverlap,
  // Asserts a string is a valid GraphQL name.
  assertValidName,
  // Determine if a string is a valid GraphQL name.
  isValidNameError,
  // Compares two GraphQLSchemas and detects breaking changes.
  BreakingChangeType,
  DangerousChangeType,
  findBreakingChanges,
  findDangerousChanges,
  // @deprecated: Report all deprecated usage within a GraphQL document.
  findDeprecatedUsages,
} from './utilities/index';

export {
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
  DangerousChange,
} from './utilities/index';
