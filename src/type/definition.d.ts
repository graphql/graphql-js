import type { Path } from '../jsutils/Path';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import type { ObjMap } from '../jsutils/ObjMap';
import type { Maybe } from '../jsutils/Maybe';
import type {
  FieldNode,
  ValueNode,
  OperationDefinitionNode,
  FragmentDefinitionNode,
  ScalarTypeDefinitionNode,
  ScalarTypeExtensionNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
  EnumTypeDefinitionNode,
  EnumValueDefinitionNode,
  EnumTypeExtensionNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
} from '../language/ast';
import type { GraphQLSchema } from './schema';
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
  | GraphQLList<GraphQLType>
  | GraphQLNonNull<
      | GraphQLScalarType
      | GraphQLObjectType
      | GraphQLInterfaceType
      | GraphQLUnionType
      | GraphQLEnumType
      | GraphQLInputObjectType
      | GraphQLList<GraphQLType>
    >;
export function isType(type: unknown): type is GraphQLType;
export function assertType(type: unknown): GraphQLType;
/**
 * There are predicates for each kind of GraphQL type.
 */
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
export function isListType(
  type: GraphQLInputType,
): type is GraphQLList<GraphQLInputType>;
export function isListType(
  type: GraphQLOutputType,
): type is GraphQLList<GraphQLOutputType>;
export function isListType(type: unknown): type is GraphQLList<GraphQLType>;
export function assertListType(type: unknown): GraphQLList<GraphQLType>;
export function isNonNullType(
  type: GraphQLInputType,
): type is GraphQLNonNull<GraphQLInputType>;
export function isNonNullType(
  type: GraphQLOutputType,
): type is GraphQLNonNull<GraphQLOutputType>;
export function isNonNullType(
  type: unknown,
): type is GraphQLNonNull<GraphQLType>;
export function assertNonNullType(type: unknown): GraphQLNonNull<GraphQLType>;
/**
 * These types may be used as input types for arguments and directives.
 */
export type GraphQLInputType =
  | GraphQLScalarType
  | GraphQLEnumType
  | GraphQLInputObjectType
  | GraphQLList<GraphQLInputType>
  | GraphQLNonNull<
      | GraphQLScalarType
      | GraphQLEnumType
      | GraphQLInputObjectType
      | GraphQLList<GraphQLInputType>
    >;
export function isInputType(type: unknown): type is GraphQLInputType;
export function assertInputType(type: unknown): GraphQLInputType;
/**
 * These types may be used as output types as the result of fields.
 */
export type GraphQLOutputType =
  | GraphQLScalarType
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType
  | GraphQLList<GraphQLOutputType>
  | GraphQLNonNull<
      | GraphQLScalarType
      | GraphQLObjectType
      | GraphQLInterfaceType
      | GraphQLUnionType
      | GraphQLEnumType
      | GraphQLList<GraphQLOutputType>
    >;
export function isOutputType(type: unknown): type is GraphQLOutputType;
export function assertOutputType(type: unknown): GraphQLOutputType;
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
 * List Type Wrapper
 *
 * A list is a wrapping type which points to another type.
 * Lists are often created within the context of defining the fields of
 * an object type.
 *
 * Example:
 *
 *     const PersonType = new GraphQLObjectType({
 *       name: 'Person',
 *       fields: () => ({
 *         parents: { type: new GraphQLList(PersonType) },
 *         children: { type: new GraphQLList(PersonType) },
 *       })
 *     })
 *
 */
export class GraphQLList<T extends GraphQLType> {
  readonly ofType: T;
  constructor(ofType: T);
  toString(): string;
  toJSON(): string;
  get [Symbol.toStringTag](): string;
}
/**
 * Non-Null Type Wrapper
 *
 * A non-null is a wrapping type which points to another type.
 * Non-null types enforce that their values are never null and can ensure
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
  constructor(ofType: T);
  toString(): string;
  toJSON(): string;
  get [Symbol.toStringTag](): string;
}
/**
 * These types wrap and modify other types
 */
export type GraphQLWrappingType =
  | GraphQLList<GraphQLType>
  | GraphQLNonNull<GraphQLType>;
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
  | GraphQLList<GraphQLType>;
export function isNullableType(type: unknown): type is GraphQLNullableType;
export function assertNullableType(type: unknown): GraphQLNullableType;
export function getNullableType(type: undefined | null): void;
export function getNullableType<T extends GraphQLNullableType>(
  type: T | GraphQLNonNull<T>,
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
export function getNamedType(type: undefined | null): void;
export function getNamedType(type: GraphQLInputType): GraphQLNamedInputType;
export function getNamedType(type: GraphQLOutputType): GraphQLNamedOutputType;
export function getNamedType(type: GraphQLType): GraphQLNamedType;
/**
 * Used while defining GraphQL types to allow for circular references in
 * otherwise immutable type definitions.
 */
export type ThunkArray<T> = (() => Array<T>) | Array<T>;
export type ThunkObjMap<T> = (() => ObjMap<T>) | ObjMap<T>;
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
 * If a type's serialize function does not return a value (i.e. it returns
 * `undefined`) then an error will be raised and a `null` value will be returned
 * in the response. If the serialize function returns `null`, then no error will
 * be included in the response.
 *
 * Example:
 *
 *     const OddType = new GraphQLScalarType({
 *       name: 'Odd',
 *       serialize(value) {
 *         if (value % 2 === 1) {
 *           return value;
 *         }
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
  toConfig(): GraphQLScalarTypeNormalizedConfig;
  toString(): string;
  toJSON(): string;
  get [Symbol.toStringTag](): string;
}
export type GraphQLScalarSerializer<TExternal> = (
  outputValue: unknown,
) => Maybe<TExternal>;
export type GraphQLScalarValueParser<TInternal> = (
  inputValue: unknown,
) => Maybe<TInternal>;
export type GraphQLScalarLiteralParser<TInternal> = (
  valueNode: ValueNode,
  variables: Maybe<ObjMap<unknown>>,
) => Maybe<TInternal>;
export interface GraphQLScalarTypeConfig<TInternal, TExternal> {
  name: string;
  description?: Maybe<string>;
  specifiedByURL?: Maybe<string>;
  /** Serializes an internal value to include in a response. */
  serialize?: GraphQLScalarSerializer<TExternal>;
  /** Parses an externally provided value to use as an input. */
  parseValue?: GraphQLScalarValueParser<TInternal>;
  /** Parses an externally provided literal value to use as an input. */
  parseLiteral?: GraphQLScalarLiteralParser<TInternal>;
  extensions?: Maybe<Readonly<GraphQLScalarTypeExtensions>>;
  astNode?: Maybe<ScalarTypeDefinitionNode>;
  extensionASTNodes?: Maybe<ReadonlyArray<ScalarTypeExtensionNode>>;
}
interface GraphQLScalarTypeNormalizedConfig
  extends GraphQLScalarTypeConfig<unknown, unknown> {
  serialize: GraphQLScalarSerializer<unknown>;
  parseValue: GraphQLScalarValueParser<unknown>;
  parseLiteral: GraphQLScalarLiteralParser<unknown>;
  extensions: Maybe<Readonly<GraphQLScalarTypeExtensions>>;
  extensionASTNodes: ReadonlyArray<ScalarTypeExtensionNode>;
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
  private _fields;
  private _interfaces;
  constructor(config: Readonly<GraphQLObjectTypeConfig<TSource, TContext>>);
  getFields(): GraphQLFieldMap<TSource, TContext>;
  getInterfaces(): Array<GraphQLInterfaceType>;
  toConfig(): GraphQLObjectTypeNormalizedConfig<TSource, TContext>;
  toString(): string;
  toJSON(): string;
  get [Symbol.toStringTag](): string;
}
export function defineArguments(
  config: GraphQLFieldConfigArgumentMap,
): ReadonlyArray<GraphQLArgument>;
/**
 * @internal
 */
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
interface GraphQLObjectTypeNormalizedConfig<TSource, TContext>
  extends GraphQLObjectTypeConfig<any, any> {
  interfaces: Array<GraphQLInterfaceType>;
  fields: GraphQLFieldConfigMap<any, any>;
  extensions: Maybe<Readonly<GraphQLObjectTypeExtensions<TSource, TContext>>>;
  extensionASTNodes: ReadonlyArray<ObjectTypeExtensionNode>;
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
  TArgs = {
    [argument: string]: any;
  },
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
  readonly variableValues: {
    [variable: string]: unknown;
  };
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
  _TArgs = {
    [argName: string]: any;
  },
> {
  [attributeName: string]: unknown;
}
export interface GraphQLFieldConfig<
  TSource,
  TContext,
  TArgs = {
    [argument: string]: any;
  },
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
  TArgs = {
    [argument: string]: any;
  },
> {
  name: string;
  description: Maybe<string>;
  type: GraphQLOutputType;
  args: Array<GraphQLArgument>;
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  deprecationReason: Maybe<string>;
  extensions: Maybe<Readonly<GraphQLFieldExtensions<TSource, TContext, TArgs>>>;
  astNode: Maybe<FieldDefinitionNode>;
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
  astNode: Maybe<InterfaceTypeDefinitionNode>;
  extensionASTNodes: ReadonlyArray<InterfaceTypeExtensionNode>;
  private _fields;
  private _interfaces;
  constructor(config: Readonly<GraphQLInterfaceTypeConfig<any, any>>);
  getFields(): GraphQLFieldMap<any, any>;
  getInterfaces(): Array<GraphQLInterfaceType>;
  toConfig(): GraphQLInterfaceTypeNormalizedConfig;
  toString(): string;
  toJSON(): string;
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
export interface GraphQLInterfaceTypeNormalizedConfig
  extends GraphQLInterfaceTypeConfig<any, any> {
  interfaces: Array<GraphQLInterfaceType>;
  fields: GraphQLFieldConfigMap<any, any>;
  extensions: Maybe<Readonly<GraphQLInterfaceTypeExtensions>>;
  extensionASTNodes: ReadonlyArray<InterfaceTypeExtensionNode>;
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
  private _types;
  constructor(config: Readonly<GraphQLUnionTypeConfig<any, any>>);
  getTypes(): Array<GraphQLObjectType>;
  toConfig(): GraphQLUnionTypeNormalizedConfig;
  toString(): string;
  toJSON(): string;
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
interface GraphQLUnionTypeNormalizedConfig
  extends GraphQLUnionTypeConfig<any, any> {
  types: Array<GraphQLObjectType>;
  extensions: Maybe<Readonly<GraphQLUnionTypeExtensions>>;
  extensionASTNodes: ReadonlyArray<UnionTypeExtensionNode>;
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
  private _values;
  private _valueLookup;
  private _nameLookup;
  constructor(config: Readonly<GraphQLEnumTypeConfig>);
  getValues(): Array<GraphQLEnumValue>;
  getValue(name: string): Maybe<GraphQLEnumValue>;
  serialize(outputValue: unknown): Maybe<string>;
  parseValue(inputValue: unknown): Maybe<any>;
  parseLiteral(
    valueNode: ValueNode,
    _variables: Maybe<ObjMap<unknown>>,
  ): Maybe<any>;
  toConfig(): GraphQLEnumTypeNormalizedConfig;
  toString(): string;
  toJSON(): string;
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
interface GraphQLEnumTypeNormalizedConfig extends GraphQLEnumTypeConfig {
  extensions: Maybe<Readonly<GraphQLEnumTypeExtensions>>;
  extensionASTNodes: ReadonlyArray<EnumTypeExtensionNode>;
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
  astNode: Maybe<EnumValueDefinitionNode>;
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
  private _fields;
  constructor(config: Readonly<GraphQLInputObjectTypeConfig>);
  getFields(): GraphQLInputFieldMap;
  toConfig(): GraphQLInputObjectTypeNormalizedConfig;
  toString(): string;
  toJSON(): string;
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
interface GraphQLInputObjectTypeNormalizedConfig
  extends GraphQLInputObjectTypeConfig {
  fields: GraphQLInputFieldConfigMap;
  extensions: Maybe<Readonly<GraphQLInputObjectTypeExtensions>>;
  extensionASTNodes: ReadonlyArray<InputObjectTypeExtensionNode>;
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
  [attributeName: string]: unknown;
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
  description: Maybe<string>;
  type: GraphQLInputType;
  defaultValue: unknown;
  deprecationReason: Maybe<string>;
  extensions: Maybe<Readonly<GraphQLInputFieldExtensions>>;
  astNode: Maybe<InputValueDefinitionNode>;
}
export function isRequiredInputField(field: GraphQLInputField): boolean;
export type GraphQLInputFieldMap = ObjMap<GraphQLInputField>;
