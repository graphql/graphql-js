// FIXME
/* eslint-disable import/no-cycle */

import { Maybe } from '../jsutils/Maybe';

import { PromiseOrValue } from '../jsutils/PromiseOrValue';
import { Path } from '../jsutils/Path';
import { ObjMap } from '../jsutils/ObjMap';

import {
  ScalarTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode,
  EnumTypeDefinitionNode,
  EnumValueDefinitionNode,
  InputObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  InterfaceTypeExtensionNode,
  OperationDefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
  ValueNode,
  ScalarTypeExtensionNode,
  UnionTypeExtensionNode,
  EnumTypeExtensionNode,
  InputObjectTypeExtensionNode,
} from '../language/ast';

import { GraphQLSchema } from './schema';

/**
 * These are all of the possible kinds of types.
 */
export type GraphQLType =
  | GraphQLScalarType
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType
  | GraphQLInputObjectType
  | GraphQLList<any>
  | GraphQLNonNull<any>;

export function isType(type: unknown): type is GraphQLType;

export function assertType(type: unknown): GraphQLType;

export function isScalarType(type: unknown): type is GraphQLScalarType;

export function assertScalarType(type: unknown): GraphQLScalarType;

export function isObjectType(type: unknown): type is GraphQLObjectType;

export function assertObjectType(type: unknown): GraphQLObjectType;

export function isInterfaceType(type: unknown): type is GraphQLInterfaceType;

export function assertInterfaceType(type: unknown): GraphQLInterfaceType;

export function isUnionType(type: unknown): type is GraphQLUnionType;

export function assertUnionType(type: unknown): GraphQLUnionType;

export function isEnumType(type: unknown): type is GraphQLEnumType;

export function assertEnumType(type: unknown): GraphQLEnumType;

export function isInputObjectType(
  type: unknown,
): type is GraphQLInputObjectType;

export function assertInputObjectType(type: unknown): GraphQLInputObjectType;

export function isListType(type: unknown): type is GraphQLList<any>;

export function assertListType(type: unknown): GraphQLList<any>;

export function isNonNullType(type: unknown): type is GraphQLNonNull<any>;

export function assertNonNullType(type: unknown): GraphQLNonNull<any>;

/**
 * These types may be used as input types for arguments and directives.
 */
// TS_SPECIFIC: TS does not allow recursive type definitions, hence the `any`s
export type GraphQLInputType =
  | GraphQLScalarType
  | GraphQLEnumType
  | GraphQLInputObjectType
  | GraphQLList<any>
  | GraphQLNonNull<
      | GraphQLScalarType
      | GraphQLEnumType
      | GraphQLInputObjectType
      | GraphQLList<any>
    >;

export function isInputType(type: unknown): type is GraphQLInputType;

export function assertInputType(type: unknown): GraphQLInputType;

/**
 * These types may be used as output types as the result of fields.
 */
// TS_SPECIFIC: TS does not allow recursive type definitions, hence the `any`s
export type GraphQLOutputType =
  | GraphQLScalarType
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType
  | GraphQLList<any>
  | GraphQLNonNull<
      | GraphQLScalarType
      | GraphQLObjectType
      | GraphQLInterfaceType
      | GraphQLUnionType
      | GraphQLEnumType
      | GraphQLList<any>
    >;

export function isOutputType(type: any): type is GraphQLOutputType;

export function assertOutputType(type: any): GraphQLOutputType;

/**
 * These types may describe types which may be leaf values.
 */
export type GraphQLLeafType = GraphQLScalarType | GraphQLEnumType;

export function isLeafType(type: unknown): type is GraphQLLeafType;

export function assertLeafType(type: unknown): GraphQLLeafType;

/**
 * These types may describe the parent context of a selection set.
 */
export type GraphQLCompositeType =
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType;

export function isCompositeType(type: unknown): type is GraphQLCompositeType;

export function assertCompositeType(type: unknown): GraphQLCompositeType;

/**
 * These types may describe the parent context of a selection set.
 */
export type GraphQLAbstractType = GraphQLInterfaceType | GraphQLUnionType;

export function isAbstractType(type: unknown): type is GraphQLAbstractType;

export function assertAbstractType(type: unknown): GraphQLAbstractType;

/**
 * List Modifier
 *
 * A list is a kind of type marker, a wrapping type which points to another
 * type. Lists are often created within the context of defining the fields
 * of an object type.
 *
 * Example:
 *
 *     const PersonType = new GraphQLObjectType({
 *       name: 'Person',
 *       fields: () => ({
 *         parents: { type: new GraphQLList(Person) },
 *         children: { type: new GraphQLList(Person) },
 *       })
 *     })
 *
 */
export class GraphQLList<T extends GraphQLType> {
  readonly ofType: T;

  constructor(type: T);

  toString: () => string;
  toJSON: () => string;
  inspect: () => string;
  get [Symbol.toStringTag](): string;
}

/**
 * Non-Null Modifier
 *
 * A non-null is a kind of type marker, a wrapping type which points to another
 * type. Non-null types enforce that their values are never null and can ensure
 * an error is raised if this ever occurs during a request. It is useful for
 * fields which you can make a strong guarantee on non-nullability, for example
 * usually the id field of a database row will never be null.
 *
 * Example:
 *
 *     const RowType = new GraphQLObjectType({
 *       name: 'Row',
 *       fields: () => ({
 *         id: { type: new GraphQLNonNull(GraphQLString) },
 *       })
 *     })
 *
 * Note: the enforcement of non-nullability occurs within the executor.
 */
export class GraphQLNonNull<T extends GraphQLNullableType> {
  readonly ofType: T;

  constructor(type: T);

  toString: () => string;
  toJSON: () => string;
  inspect: () => string;
  get [Symbol.toStringTag](): string;
}

export type GraphQLWrappingType = GraphQLList<any> | GraphQLNonNull<any>;

export function isWrappingType(type: unknown): type is GraphQLWrappingType;

export function assertWrappingType(type: unknown): GraphQLWrappingType;

/**
 * These types can all accept null as a value.
 */
export type GraphQLNullableType =
  | GraphQLScalarType
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType
  | GraphQLInputObjectType
  | GraphQLList<any>;

export function isNullableType(type: unknown): type is GraphQLNullableType;

export function assertNullableType(type: unknown): GraphQLNullableType;

export function getNullableType(type: undefined): undefined;
export function getNullableType<T extends GraphQLNullableType>(type: T): T;
export function getNullableType<T extends GraphQLNullableType>(
  // FIXME Disabled because of https://github.com/yaacovCR/graphql-tools-fork/issues/40#issuecomment-586671219
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  type: GraphQLNonNull<T>,
): T;

/**
 * These named types do not include modifiers like List or NonNull.
 */
export type GraphQLNamedType = GraphQLNamedInputType | GraphQLNamedOutputType;

export type GraphQLNamedInputType =
  | GraphQLScalarType
  | GraphQLEnumType
  | GraphQLInputObjectType;

export type GraphQLNamedOutputType =
  | GraphQLScalarType
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType;

export function isNamedType(type: unknown): type is GraphQLNamedType;

export function assertNamedType(type: unknown): GraphQLNamedType;

export function getNamedType(type: undefined): undefined;
export function getNamedType(type: GraphQLInputType): GraphQLNamedInputType;
export function getNamedType(type: GraphQLOutputType): GraphQLNamedOutputType;
export function getNamedType(type: GraphQLType): GraphQLNamedType;

/**
 * Used while defining GraphQL types to allow for circular references in
 * otherwise immutable type definitions.
 */
export type ThunkArray<T> = Array<T> | (() => Array<T>);
export type ThunkObjMap<T> = ObjMap<T> | (() => ObjMap<T>);

/**
 * Custom extensions
 *
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLScalarTypeExtensions {
  [attributeName: string]: unknown;
}

/**
 * Scalar Type Definition
 *
 * The leaf values of any request and input values to arguments are
 * Scalars (or Enums) and are defined with a name and a series of functions
 * used to parse input from ast or variables and to ensure validity.
 *
 * Example:
 *
 *     const OddType = new GraphQLScalarType({
 *       name: 'Odd',
 *       serialize(value) {
 *         return value % 2 === 1 ? value : null;
 *       }
 *     });
 *
 */
export class GraphQLScalarType {
  name: string;
  description: Maybe<string>;
  specifiedByURL: Maybe<string>;
  serialize: GraphQLScalarSerializer<unknown>;
  parseValue: GraphQLScalarValueParser<unknown>;
  parseLiteral: GraphQLScalarLiteralParser<unknown>;
  extensions: Maybe<Readonly<GraphQLScalarTypeExtensions>>;
  astNode: Maybe<ScalarTypeDefinitionNode>;
  extensionASTNodes: ReadonlyArray<ScalarTypeExtensionNode>;

  constructor(config: Readonly<GraphQLScalarTypeConfig<unknown, unknown>>);

  toConfig(): GraphQLScalarTypeConfig<unknown, unknown> & {
    specifiedByURL: Maybe<string>;
    serialize: GraphQLScalarSerializer<unknown>;
    parseValue: GraphQLScalarValueParser<unknown>;
    parseLiteral: GraphQLScalarLiteralParser<unknown>;
    extensions: Maybe<Readonly<GraphQLScalarTypeExtensions>>;
    extensionASTNodes: ReadonlyArray<ScalarTypeExtensionNode>;
  };

  toString(): string;
  toJSON(): string;
  inspect(): string;
}

export type GraphQLScalarSerializer<TExternal> = (
  value: unknown,
) => Maybe<TExternal>;
export type GraphQLScalarValueParser<TInternal> = (
  value: unknown,
) => Maybe<TInternal>;
export type GraphQLScalarLiteralParser<TInternal> = (
  valueNode: ValueNode,
  variables: Maybe<ObjMap<unknown>>,
) => Maybe<TInternal>;

export interface GraphQLScalarTypeConfig<TInternal, TExternal> {
  name: string;
  description?: Maybe<string>;
  specifiedBy?: Maybe<string>;
  // Serializes an internal value to include in a response.
  serialize?: GraphQLScalarSerializer<TExternal>;
  // Parses an externally provided value to use as an input.
  parseValue?: GraphQLScalarValueParser<TInternal>;
  // Parses an externally provided literal value to use as an input.
  parseLiteral?: GraphQLScalarLiteralParser<TInternal>;
  extensions?: Maybe<Readonly<GraphQLScalarTypeExtensions>>;
  astNode?: Maybe<ScalarTypeDefinitionNode>;
  extensionASTNodes?: Maybe<ReadonlyArray<ScalarTypeExtensionNode>>;
}

/**
 * Custom extensions
 *
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 *
 * We've provided these template arguments because this is an open type and
 * you may find them useful.
 */
export interface GraphQLObjectTypeExtensions<_TSource = any, _TContext = any> {
  [attributeName: string]: unknown;
}

/**
 * Object Type Definition
 *
 * Almost all of the GraphQL types you define will be object types. Object types
 * have a name, but most importantly describe their fields.
 *
 * Example:
 *
 *     const AddressType = new GraphQLObjectType({
 *       name: 'Address',
 *       fields: {
 *         street: { type: GraphQLString },
 *         number: { type: GraphQLInt },
 *         formatted: {
 *           type: GraphQLString,
 *           resolve(obj) {
 *             return obj.number + ' ' + obj.street
 *           }
 *         }
 *       }
 *     });
 *
 * When two types need to refer to each other, or a type needs to refer to
 * itself in a field, you can use a function expression (aka a closure or a
 * thunk) to supply the fields lazily.
 *
 * Example:
 *
 *     const PersonType = new GraphQLObjectType({
 *       name: 'Person',
 *       fields: () => ({
 *         name: { type: GraphQLString },
 *         bestFriend: { type: PersonType },
 *       })
 *     });
 *
 */
export class GraphQLObjectType<TSource = any, TContext = any> {
  name: string;
  description: Maybe<string>;
  isTypeOf: Maybe<GraphQLIsTypeOfFn<TSource, TContext>>;
  extensions: Maybe<Readonly<GraphQLObjectTypeExtensions<TSource, TContext>>>;
  astNode: Maybe<ObjectTypeDefinitionNode>;
  extensionASTNodes: ReadonlyArray<ObjectTypeExtensionNode>;

  constructor(config: Readonly<GraphQLObjectTypeConfig<TSource, TContext>>);

  getFields(): GraphQLFieldMap<any, TContext>;
  getInterfaces(): Array<GraphQLInterfaceType>;

  toConfig(): GraphQLObjectTypeConfig<any, any> & {
    interfaces: Array<GraphQLInterfaceType>;
    fields: GraphQLFieldConfigMap<any, any>;
    extensions: Maybe<Readonly<GraphQLObjectTypeExtensions<TSource, TContext>>>;
    extensionASTNodes: ReadonlyArray<ObjectTypeExtensionNode>;
  };

  toString(): string;
  toJSON(): string;
  inspect(): string;
  get [Symbol.toStringTag](): string;
}

export function argsToArgsConfig(
  args: ReadonlyArray<GraphQLArgument>,
): GraphQLFieldConfigArgumentMap;

export interface GraphQLObjectTypeConfig<TSource, TContext> {
  name: string;
  description?: Maybe<string>;
  interfaces?: ThunkArray<GraphQLInterfaceType>;
  fields: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>;
  isTypeOf?: Maybe<GraphQLIsTypeOfFn<TSource, TContext>>;
  extensions?: Maybe<Readonly<GraphQLObjectTypeExtensions<TSource, TContext>>>;
  astNode?: Maybe<ObjectTypeDefinitionNode>;
  extensionASTNodes?: Maybe<ReadonlyArray<ObjectTypeExtensionNode>>;
}

export type GraphQLTypeResolver<TSource, TContext> = (
  value: TSource,
  context: TContext,
  info: GraphQLResolveInfo,
  abstractType: GraphQLAbstractType,
) => PromiseOrValue<string | undefined>;

export type GraphQLIsTypeOfFn<TSource, TContext> = (
  source: TSource,
  context: TContext,
  info: GraphQLResolveInfo,
) => PromiseOrValue<boolean>;

export type GraphQLFieldResolver<
  TSource,
  TContext,
  TArgs = { [argName: string]: any }
> = (
  source: TSource,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => unknown;

export interface GraphQLResolveInfo {
  readonly fieldName: string;
  readonly fieldNodes: ReadonlyArray<FieldNode>;
  readonly returnType: GraphQLOutputType;
  readonly parentType: GraphQLObjectType;
  readonly path: Path;
  readonly schema: GraphQLSchema;
  readonly fragments: ObjMap<FragmentDefinitionNode>;
  readonly rootValue: unknown;
  readonly operation: OperationDefinitionNode;
  readonly variableValues: { [variableName: string]: unknown };
}

/**
 * Custom extensions
 *
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 *
 * We've provided these template arguments because this is an open type and
 * you may find them useful.
 */
export interface GraphQLFieldExtensions<
  _TSource,
  _TContext,
  _TArgs = { [argName: string]: any }
> {
  [attributeName: string]: unknown;
}

export interface GraphQLFieldConfig<
  TSource,
  TContext,
  TArgs = { [argName: string]: any }
> {
  description?: Maybe<string>;
  type: GraphQLOutputType;
  args?: GraphQLFieldConfigArgumentMap;
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  deprecationReason?: Maybe<string>;
  extensions?: Maybe<
    Readonly<GraphQLFieldExtensions<TSource, TContext, TArgs>>
  >;
  astNode?: Maybe<FieldDefinitionNode>;
}

export type GraphQLFieldConfigArgumentMap = ObjMap<GraphQLArgumentConfig>;

/**
 * Custom extensions
 *
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLArgumentExtensions {
  [attributeName: string]: unknown;
}

export interface GraphQLArgumentConfig {
  description?: Maybe<string>;
  type: GraphQLInputType;
  defaultValue?: unknown;
  deprecationReason?: Maybe<string>;
  extensions?: Maybe<Readonly<GraphQLArgumentExtensions>>;
  astNode?: Maybe<InputValueDefinitionNode>;
}

export type GraphQLFieldConfigMap<TSource, TContext> = ObjMap<
  GraphQLFieldConfig<TSource, TContext>
>;

export interface GraphQLField<
  TSource,
  TContext,
  TArgs = { [key: string]: any }
> {
  name: string;
  description: Maybe<string>;
  type: GraphQLOutputType;
  args: Array<GraphQLArgument>;
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  deprecationReason: Maybe<string>;
  extensions: Maybe<Readonly<GraphQLFieldExtensions<TSource, TContext, TArgs>>>;
  astNode?: Maybe<FieldDefinitionNode>;
}

export interface GraphQLArgument {
  name: string;
  description: Maybe<string>;
  type: GraphQLInputType;
  defaultValue: unknown;
  deprecationReason: Maybe<string>;
  extensions: Maybe<Readonly<GraphQLArgumentExtensions>>;
  astNode: Maybe<InputValueDefinitionNode>;
}

export function isRequiredArgument(arg: GraphQLArgument): boolean;

export type GraphQLFieldMap<TSource, TContext> = ObjMap<
  GraphQLField<TSource, TContext>
>;

/**
 * Custom extensions
 *
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLInterfaceTypeExtensions {
  [attributeName: string]: unknown;
}

/**
 * Interface Type Definition
 *
 * When a field can return one of a heterogeneous set of types, a Interface type
 * is used to describe what types are possible, what fields are in common across
 * all types, as well as a function to determine which type is actually used
 * when the field is resolved.
 *
 * Example:
 *
 *     const EntityType = new GraphQLInterfaceType({
 *       name: 'Entity',
 *       fields: {
 *         name: { type: GraphQLString }
 *       }
 *     });
 *
 */
export class GraphQLInterfaceType {
  name: string;
  description: Maybe<string>;
  resolveType: Maybe<GraphQLTypeResolver<any, any>>;
  extensions: Maybe<Readonly<GraphQLInterfaceTypeExtensions>>;
  astNode?: Maybe<InterfaceTypeDefinitionNode>;
  extensionASTNodes: ReadonlyArray<InterfaceTypeExtensionNode>;

  constructor(config: Readonly<GraphQLInterfaceTypeConfig<any, any>>);
  getFields(): GraphQLFieldMap<any, any>;
  getInterfaces(): Array<GraphQLInterfaceType>;

  toConfig(): GraphQLInterfaceTypeConfig<any, any> & {
    interfaces: Array<GraphQLInterfaceType>;
    fields: GraphQLFieldConfigMap<any, any>;
    extensions: Maybe<Readonly<GraphQLInterfaceTypeExtensions>>;
    extensionASTNodes: ReadonlyArray<InterfaceTypeExtensionNode>;
  };

  toString(): string;
  toJSON(): string;
  inspect(): string;
  get [Symbol.toStringTag](): string;
}

export interface GraphQLInterfaceTypeConfig<TSource, TContext> {
  name: string;
  description?: Maybe<string>;
  interfaces?: ThunkArray<GraphQLInterfaceType>;
  fields: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>;
  /**
   * Optionally provide a custom type resolver function. If one is not provided,
   * the default implementation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: Maybe<GraphQLTypeResolver<TSource, TContext>>;
  extensions?: Maybe<Readonly<GraphQLInterfaceTypeExtensions>>;
  astNode?: Maybe<InterfaceTypeDefinitionNode>;
  extensionASTNodes?: Maybe<ReadonlyArray<InterfaceTypeExtensionNode>>;
}

/**
 * Custom extensions
 *
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLUnionTypeExtensions {
  [attributeName: string]: unknown;
}

/**
 * Union Type Definition
 *
 * When a field can return one of a heterogeneous set of types, a Union type
 * is used to describe what types are possible as well as providing a function
 * to determine which type is actually used when the field is resolved.
 *
 * Example:
 *
 *     const PetType = new GraphQLUnionType({
 *       name: 'Pet',
 *       types: [ DogType, CatType ],
 *       resolveType(value) {
 *         if (value instanceof Dog) {
 *           return DogType;
 *         }
 *         if (value instanceof Cat) {
 *           return CatType;
 *         }
 *       }
 *     });
 *
 */
export class GraphQLUnionType {
  name: string;
  description: Maybe<string>;
  resolveType: Maybe<GraphQLTypeResolver<any, any>>;
  extensions: Maybe<Readonly<GraphQLUnionTypeExtensions>>;
  astNode: Maybe<UnionTypeDefinitionNode>;
  extensionASTNodes: ReadonlyArray<UnionTypeExtensionNode>;

  constructor(config: Readonly<GraphQLUnionTypeConfig<any, any>>);
  getTypes(): Array<GraphQLObjectType>;

  toConfig(): GraphQLUnionTypeConfig<any, any> & {
    types: Array<GraphQLObjectType>;
    extensions: Maybe<Readonly<GraphQLUnionTypeExtensions>>;
    extensionASTNodes: ReadonlyArray<UnionTypeExtensionNode>;
  };

  toString(): string;
  toJSON(): string;
  inspect(): string;
  get [Symbol.toStringTag](): string;
}

export interface GraphQLUnionTypeConfig<TSource, TContext> {
  name: string;
  description?: Maybe<string>;
  types: ThunkArray<GraphQLObjectType>;
  /**
   * Optionally provide a custom type resolver function. If one is not provided,
   * the default implementation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: Maybe<GraphQLTypeResolver<TSource, TContext>>;
  extensions?: Maybe<Readonly<GraphQLUnionTypeExtensions>>;
  astNode?: Maybe<UnionTypeDefinitionNode>;
  extensionASTNodes?: Maybe<ReadonlyArray<UnionTypeExtensionNode>>;
}

/**
 * Custom extensions
 *
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLEnumTypeExtensions {
  [attributeName: string]: unknown;
}

/**
 * Enum Type Definition
 *
 * Some leaf values of requests and input values are Enums. GraphQL serializes
 * Enum values as strings, however internally Enums can be represented by any
 * kind of type, often integers.
 *
 * Example:
 *
 *     const RGBType = new GraphQLEnumType({
 *       name: 'RGB',
 *       values: {
 *         RED: { value: 0 },
 *         GREEN: { value: 1 },
 *         BLUE: { value: 2 }
 *       }
 *     });
 *
 * Note: If a value is not provided in a definition, the name of the enum value
 * will be used as its internal value.
 */
export class GraphQLEnumType {
  name: string;
  description: Maybe<string>;
  extensions: Maybe<Readonly<GraphQLEnumTypeExtensions>>;
  astNode: Maybe<EnumTypeDefinitionNode>;
  extensionASTNodes: ReadonlyArray<EnumTypeExtensionNode>;

  constructor(config: Readonly<GraphQLEnumTypeConfig>);
  getValues(): Array<GraphQLEnumValue>;
  getValue(name: string): Maybe<GraphQLEnumValue>;
  serialize(value: unknown): Maybe<string>;
  parseValue(value: unknown): Maybe<any>;
  parseLiteral(
    valueNode: ValueNode,
    _variables: Maybe<ObjMap<unknown>>,
  ): Maybe<any>;

  toConfig(): GraphQLEnumTypeConfig & {
    extensions: Maybe<Readonly<GraphQLEnumTypeExtensions>>;
    extensionASTNodes: ReadonlyArray<EnumTypeExtensionNode>;
  };

  toString(): string;
  toJSON(): string;
  inspect(): string;
  get [Symbol.toStringTag](): string;
}

export interface GraphQLEnumTypeConfig {
  name: string;
  description?: Maybe<string>;
  values: GraphQLEnumValueConfigMap;
  extensions?: Maybe<Readonly<GraphQLEnumTypeExtensions>>;
  astNode?: Maybe<EnumTypeDefinitionNode>;
  extensionASTNodes?: Maybe<ReadonlyArray<EnumTypeExtensionNode>>;
}

export type GraphQLEnumValueConfigMap = ObjMap<GraphQLEnumValueConfig>;

/**
 * Custom extensions
 *
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLEnumValueExtensions {
  [attributeName: string]: unknown;
}

export interface GraphQLEnumValueConfig {
  description?: Maybe<string>;
  value?: any;
  deprecationReason?: Maybe<string>;
  extensions?: Maybe<Readonly<GraphQLEnumValueExtensions>>;
  astNode?: Maybe<EnumValueDefinitionNode>;
}

export interface GraphQLEnumValue {
  name: string;
  description: Maybe<string>;
  value: any;
  deprecationReason: Maybe<string>;
  extensions: Maybe<Readonly<GraphQLEnumValueExtensions>>;
  astNode?: Maybe<EnumValueDefinitionNode>;
}

/**
 * Custom extensions
 *
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLInputObjectTypeExtensions {
  [attributeName: string]: unknown;
}

/**
 * Input Object Type Definition
 *
 * An input object defines a structured collection of fields which may be
 * supplied to a field argument.
 *
 * Using `NonNull` will ensure that a value must be provided by the query
 *
 * Example:
 *
 *     const GeoPoint = new GraphQLInputObjectType({
 *       name: 'GeoPoint',
 *       fields: {
 *         lat: { type: new GraphQLNonNull(GraphQLFloat) },
 *         lon: { type: new GraphQLNonNull(GraphQLFloat) },
 *         alt: { type: GraphQLFloat, defaultValue: 0 },
 *       }
 *     });
 *
 */
export class GraphQLInputObjectType {
  name: string;
  description: Maybe<string>;
  extensions: Maybe<Readonly<GraphQLInputObjectTypeExtensions>>;
  astNode: Maybe<InputObjectTypeDefinitionNode>;
  extensionASTNodes: ReadonlyArray<InputObjectTypeExtensionNode>;

  constructor(config: Readonly<GraphQLInputObjectTypeConfig>);
  getFields(): GraphQLInputFieldMap;

  toConfig(): GraphQLInputObjectTypeConfig & {
    fields: GraphQLInputFieldConfigMap;
    extensions: Maybe<Readonly<GraphQLInputObjectTypeExtensions>>;
    extensionASTNodes: ReadonlyArray<InputObjectTypeExtensionNode>;
  };

  toString(): string;
  toJSON(): string;
  inspect(): string;
  get [Symbol.toStringTag](): string;
}

export interface GraphQLInputObjectTypeConfig {
  name: string;
  description?: Maybe<string>;
  fields: ThunkObjMap<GraphQLInputFieldConfig>;
  extensions?: Maybe<Readonly<GraphQLInputObjectTypeExtensions>>;
  astNode?: Maybe<InputObjectTypeDefinitionNode>;
  extensionASTNodes?: Maybe<ReadonlyArray<InputObjectTypeExtensionNode>>;
}

/**
 * Custom extensions
 *
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLInputFieldExtensions {
  [attributeName: string]: any;
}

export interface GraphQLInputFieldConfig {
  description?: Maybe<string>;
  type: GraphQLInputType;
  defaultValue?: unknown;
  deprecationReason?: Maybe<string>;
  extensions?: Maybe<Readonly<GraphQLInputFieldExtensions>>;
  astNode?: Maybe<InputValueDefinitionNode>;
}

export type GraphQLInputFieldConfigMap = ObjMap<GraphQLInputFieldConfig>;

export interface GraphQLInputField {
  name: string;
  description?: Maybe<string>;
  type: GraphQLInputType;
  defaultValue?: unknown;
  deprecationReason: Maybe<string>;
  extensions: Maybe<Readonly<GraphQLInputFieldExtensions>>;
  astNode?: Maybe<InputValueDefinitionNode>;
}

export function isRequiredInputField(field: GraphQLInputField): boolean;

export type GraphQLInputFieldMap = ObjMap<GraphQLInputField>;
