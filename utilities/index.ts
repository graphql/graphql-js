// Produce the GraphQL query recommended for a full schema introspection.
export { getIntrospectionQuery } from './getIntrospectionQuery.ts';
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
} from './getIntrospectionQuery.ts';
// Gets the target Operation from a Document.
export { getOperationAST } from './getOperationAST.ts';
// Convert a GraphQLSchema to an IntrospectionQuery.
export { introspectionFromSchema } from './introspectionFromSchema.ts';
// Build a GraphQLSchema from an introspection result.
export { buildClientSchema } from './buildClientSchema.ts';
// Build a GraphQLSchema from GraphQL Schema language.
export { buildASTSchema, buildSchema } from './buildASTSchema.ts';
export type { BuildSchemaOptions } from './buildASTSchema.ts';
// Extends an existing GraphQLSchema from a parsed GraphQL Schema language AST.
export { extendSchema } from './extendSchema.ts';
// Sort a GraphQLSchema.
export { lexicographicSortSchema } from './lexicographicSortSchema.ts';
// Print a GraphQLSchema to GraphQL Schema language.
export {
  printSchema,
  printType,
  printIntrospectionSchema,
} from './printSchema.ts';
// Create a GraphQLType from a GraphQL language AST.
export { typeFromAST } from './typeFromAST.ts';
// Create a JavaScript value from a GraphQL language AST with a type.
export { valueFromAST } from './valueFromAST.ts';
// Create a JavaScript value from a GraphQL language AST without a type.
export { valueFromASTUntyped } from './valueFromASTUntyped.ts';
// Create a GraphQL language AST from a JavaScript value.
export { astFromValue } from './astFromValue.ts';
// A helper to use within recursive-descent visitors which need to be aware of the GraphQL type system.
export { TypeInfo, visitWithTypeInfo } from './TypeInfo.ts';
// Coerces a JavaScript value to a GraphQL type, or produces errors.
export { coerceInputValue } from './coerceInputValue.ts';
// Concatenates multiple AST together.
export { concatAST } from './concatAST.ts';
// Separates an AST into an AST per Operation.
export { separateOperations } from './separateOperations.ts';
// Strips characters that are not significant to the validity or execution of a GraphQL document.
export { stripIgnoredCharacters } from './stripIgnoredCharacters.ts';
// Comparators for types
export {
  isEqualType,
  isTypeSubTypeOf,
  doTypesOverlap,
} from './typeComparators.ts';
// Compares two GraphQLSchemas and detects breaking changes.
export {
  BreakingChangeType,
  DangerousChangeType,
  findBreakingChanges,
  findDangerousChanges,
} from './findBreakingChanges.ts';
export type { BreakingChange, DangerousChange } from './findBreakingChanges.ts';
// Wrapper type that contains DocumentNode and types that can be deduced from it.
export type { TypedQueryDocumentNode } from './typedQueryDocumentNode.ts';
