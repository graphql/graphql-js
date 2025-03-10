import { devAssert } from '../jsutils/devAssert';
import { didYouMean } from '../jsutils/didYouMean';
import { identityFunc } from '../jsutils/identityFunc';
import { inspect } from '../jsutils/inspect';
import { instanceOf } from '../jsutils/instanceOf';
import { isObjectLike } from '../jsutils/isObjectLike';
import { keyMap } from '../jsutils/keyMap';
import { keyValMap } from '../jsutils/keyValMap';
import { mapValue } from '../jsutils/mapValue';
import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';
import type { Path } from '../jsutils/Path';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import { suggestionList } from '../jsutils/suggestionList';
import { toObjMap } from '../jsutils/toObjMap';

import { GraphQLError } from '../error/GraphQLError';

import type {
  EnumTypeDefinitionNode,
  EnumTypeExtensionNode,
  EnumValueDefinitionNode,
  FieldDefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  OperationDefinitionNode,
  ScalarTypeDefinitionNode,
  ScalarTypeExtensionNode,
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
  ValueNode,
} from '../language/ast';
import { Kind } from '../language/kinds';
import { print } from '../language/printer';

import { valueFromASTUntyped } from '../utilities/valueFromASTUntyped';

import { assertEnumValueName, assertName } from './assertName';
import type { GraphQLSchema } from './schema';

// Predicates & Assertions

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
    >
  | GraphQLSemanticNullable<
      | GraphQLScalarType
      | GraphQLObjectType
      | GraphQLInterfaceType
      | GraphQLUnionType
      | GraphQLEnumType
      | GraphQLInputObjectType
      | GraphQLList<GraphQLType>
    >;

export function isType(type: unknown): type is GraphQLType {
  return (
    isScalarType(type) ||
    isObjectType(type) ||
    isInterfaceType(type) ||
    isUnionType(type) ||
    isEnumType(type) ||
    isInputObjectType(type) ||
    isListType(type) ||
    isNonNullType(type) ||
    isSemanticNullableType(type)
  );
}

export function assertType(type: unknown): GraphQLType {
  if (!isType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL type.`);
  }
  return type;
}

/**
 * There are predicates for each kind of GraphQL type.
 */
export function isScalarType(type: unknown): type is GraphQLScalarType {
  return instanceOf(type, GraphQLScalarType);
}

export function assertScalarType(type: unknown): GraphQLScalarType {
  if (!isScalarType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Scalar type.`);
  }
  return type;
}

export function isObjectType(type: unknown): type is GraphQLObjectType {
  return instanceOf(type, GraphQLObjectType);
}

export function assertObjectType(type: unknown): GraphQLObjectType {
  if (!isObjectType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Object type.`);
  }
  return type;
}

export function isInterfaceType(type: unknown): type is GraphQLInterfaceType {
  return instanceOf(type, GraphQLInterfaceType);
}

export function assertInterfaceType(type: unknown): GraphQLInterfaceType {
  if (!isInterfaceType(type)) {
    throw new Error(
      `Expected ${inspect(type)} to be a GraphQL Interface type.`,
    );
  }
  return type;
}

export function isUnionType(type: unknown): type is GraphQLUnionType {
  return instanceOf(type, GraphQLUnionType);
}

export function assertUnionType(type: unknown): GraphQLUnionType {
  if (!isUnionType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Union type.`);
  }
  return type;
}

export function isEnumType(type: unknown): type is GraphQLEnumType {
  return instanceOf(type, GraphQLEnumType);
}

export function assertEnumType(type: unknown): GraphQLEnumType {
  if (!isEnumType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Enum type.`);
  }
  return type;
}

export function isInputObjectType(
  type: unknown,
): type is GraphQLInputObjectType {
  return instanceOf(type, GraphQLInputObjectType);
}

export function assertInputObjectType(type: unknown): GraphQLInputObjectType {
  if (!isInputObjectType(type)) {
    throw new Error(
      `Expected ${inspect(type)} to be a GraphQL Input Object type.`,
    );
  }
  return type;
}

export function isListType(
  type: GraphQLInputType,
): type is GraphQLList<GraphQLInputType>;
export function isListType(
  type: GraphQLOutputType,
): type is GraphQLList<GraphQLOutputType>;
export function isListType(type: unknown): type is GraphQLList<GraphQLType>;
export function isListType(type: unknown): type is GraphQLList<GraphQLType> {
  return instanceOf(type, GraphQLList);
}

export function assertListType(type: unknown): GraphQLList<GraphQLType> {
  if (!isListType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL List type.`);
  }
  return type;
}

export function isNonNullType(
  type: GraphQLInputType,
): type is GraphQLNonNull<GraphQLInputType>;
export function isNonNullType(
  type: GraphQLOutputType,
): type is GraphQLNonNull<GraphQLOutputType>;
export function isNonNullType(
  type: unknown,
): type is GraphQLNonNull<GraphQLType>;
export function isNonNullType(
  type: unknown,
): type is GraphQLNonNull<GraphQLType> {
  return instanceOf(type, GraphQLNonNull);
}

export function assertNonNullType(type: unknown): GraphQLNonNull<GraphQLType> {
  if (!isNonNullType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Non-Null type.`);
  }
  return type;
}

export function isSemanticNullableType(
  type: GraphQLInputType,
): type is GraphQLSemanticNullable<GraphQLInputType>;
export function isSemanticNullableType(
  type: GraphQLOutputType,
): type is GraphQLSemanticNullable<GraphQLOutputType>;
export function isSemanticNullableType(
  type: unknown,
): type is GraphQLSemanticNullable<GraphQLType>;
export function isSemanticNullableType(
  type: unknown,
): type is GraphQLSemanticNullable<GraphQLType> {
  return instanceOf(type, GraphQLSemanticNullable);
}

export function assertSemanticNullableType(
  type: unknown,
): GraphQLSemanticNullable<GraphQLType> {
  if (!isSemanticNullableType(type)) {
    throw new Error(
      `Expected ${inspect(type)} to be a GraphQL Semantic-Non-Null type.`,
    );
  }
  return type;
}

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

// Note: GraphQLSemanticNullableType is currently not allowed for input types
export function isInputType(type: unknown): type is GraphQLInputType {
  return (
    isScalarType(type) ||
    isEnumType(type) ||
    isInputObjectType(type) ||
    (!isSemanticNullableType(type) &&
      isWrappingType(type) &&
      isInputType(type.ofType))
  );
}

export function assertInputType(type: unknown): GraphQLInputType {
  if (!isInputType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL input type.`);
  }
  return type;
}

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
    >
  | GraphQLSemanticNullable<
      | GraphQLScalarType
      | GraphQLObjectType
      | GraphQLInterfaceType
      | GraphQLUnionType
      | GraphQLEnumType
      | GraphQLList<GraphQLOutputType>
    >;

export function isOutputType(type: unknown): type is GraphQLOutputType {
  return (
    isScalarType(type) ||
    isObjectType(type) ||
    isInterfaceType(type) ||
    isUnionType(type) ||
    isEnumType(type) ||
    (isWrappingType(type) && isOutputType(type.ofType))
  );
}

export function assertOutputType(type: unknown): GraphQLOutputType {
  if (!isOutputType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL output type.`);
  }
  return type;
}

/**
 * These types may describe types which may be leaf values.
 */
export type GraphQLLeafType = GraphQLScalarType | GraphQLEnumType;

export function isLeafType(type: unknown): type is GraphQLLeafType {
  return isScalarType(type) || isEnumType(type);
}

export function assertLeafType(type: unknown): GraphQLLeafType {
  if (!isLeafType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL leaf type.`);
  }
  return type;
}

/**
 * These types may describe the parent context of a selection set.
 */
export type GraphQLCompositeType =
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType;

export function isCompositeType(type: unknown): type is GraphQLCompositeType {
  return isObjectType(type) || isInterfaceType(type) || isUnionType(type);
}

export function assertCompositeType(type: unknown): GraphQLCompositeType {
  if (!isCompositeType(type)) {
    throw new Error(
      `Expected ${inspect(type)} to be a GraphQL composite type.`,
    );
  }
  return type;
}

/**
 * These types may describe the parent context of a selection set.
 */
export type GraphQLAbstractType = GraphQLInterfaceType | GraphQLUnionType;

export function isAbstractType(type: unknown): type is GraphQLAbstractType {
  return isInterfaceType(type) || isUnionType(type);
}

export function assertAbstractType(type: unknown): GraphQLAbstractType {
  if (!isAbstractType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL abstract type.`);
  }
  return type;
}

/**
 * List Type Wrapper
 *
 * A list is a wrapping type which points to another type.
 * Lists are often created within the context of defining the fields of
 * an object type.
 *
 * Example:
 *
 * ```ts
 * const PersonType = new GraphQLObjectType({
 *   name: 'Person',
 *   fields: () => ({
 *     parents: { type: new GraphQLList(PersonType) },
 *     children: { type: new GraphQLList(PersonType) },
 *   })
 * })
 * ```
 */
export class GraphQLList<T extends GraphQLType> {
  readonly ofType: T;

  constructor(ofType: T) {
    devAssert(
      isType(ofType),
      `Expected ${inspect(ofType)} to be a GraphQL type.`,
    );

    this.ofType = ofType;
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLList';
  }

  toString(): string {
    return '[' + String(this.ofType) + ']';
  }

  toJSON(): string {
    return this.toString();
  }
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
 * ```ts
 * const RowType = new GraphQLObjectType({
 *   name: 'Row',
 *   fields: () => ({
 *     id: { type: new GraphQLNonNull(GraphQLString) },
 *   })
 * })
 * ```
 * Note: the enforcement of non-nullability occurs within the executor.
 */
export class GraphQLNonNull<T extends GraphQLNullableType> {
  readonly ofType: T;

  constructor(ofType: T) {
    devAssert(
      isNullableType(ofType),
      `Expected ${inspect(ofType)} to be a GraphQL nullable type.`,
    );

    this.ofType = ofType;
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLNonNull';
  }

  toString(): string {
    return String(this.ofType) + '!';
  }

  toJSON(): string {
    return this.toString();
  }
}

/**
 * Semantic-Nullable Type Wrapper
 *
 * A semantic-nullable is a wrapping type which points to another type.
 * Semantic-nullable types allow their values to be null.
 *
 * Example:
 *
 * ```ts
 * const RowType = new GraphQLObjectType({
 *   name: 'Row',
 *   fields: () => ({
 *     email: { type: new GraphQLSemanticNullable(GraphQLString) },
 *   })
 * })
 * ```
 * Note: This is equivalent to the unadorned named type that is
 * used by GraphQL when it is not operating in SemanticNullability mode.
 *
 * @experimental
 */
export class GraphQLSemanticNullable<T extends GraphQLNullableType> {
  readonly ofType: T;

  constructor(ofType: T) {
    devAssert(
      isNullableType(ofType),
      `Expected ${inspect(ofType)} to be a GraphQL nullable type.`,
    );

    this.ofType = ofType;
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLSemanticNullable';
  }

  toString(): string {
    return String(this.ofType) + '?';
  }

  toJSON(): string {
    return this.toString();
  }
}

/**
 * These types wrap and modify other types
 */

export type GraphQLWrappingType =
  | GraphQLList<GraphQLType>
  | GraphQLNonNull<GraphQLType>
  | GraphQLSemanticNullable<GraphQLType>;

export function isWrappingType(type: unknown): type is GraphQLWrappingType {
  return (
    isListType(type) || isNonNullType(type) || isSemanticNullableType(type)
  );
}

export function assertWrappingType(type: unknown): GraphQLWrappingType {
  if (!isWrappingType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL wrapping type.`);
  }
  return type;
}

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

export function isNullableType(type: unknown): type is GraphQLNullableType {
  return isType(type) && !isNonNullType(type) && !isSemanticNullableType(type);
}

export function assertNullableType(type: unknown): GraphQLNullableType {
  if (!isNullableType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL nullable type.`);
  }
  return type;
}

export function getNullableType(type: undefined | null): void;
export function getNullableType<T extends GraphQLNullableType>(
  type: T | GraphQLNonNull<T> | GraphQLSemanticNullable<T>,
): T;
export function getNullableType(
  type: Maybe<GraphQLType>,
): GraphQLNullableType | undefined;
export function getNullableType(
  type: Maybe<GraphQLType>,
): GraphQLNullableType | undefined {
  if (type) {
    return isNonNullType(type) || isSemanticNullableType(type)
      ? type.ofType
      : type;
  }
}

/**
 * These named types do not include modifiers like List, NonNull, or SemanticNullable
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

export function isNamedType(type: unknown): type is GraphQLNamedType {
  return (
    isScalarType(type) ||
    isObjectType(type) ||
    isInterfaceType(type) ||
    isUnionType(type) ||
    isEnumType(type) ||
    isInputObjectType(type)
  );
}

export function assertNamedType(type: unknown): GraphQLNamedType {
  if (!isNamedType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL named type.`);
  }
  return type;
}

export function getNamedType(type: undefined | null): void;
export function getNamedType(type: GraphQLInputType): GraphQLNamedInputType;
export function getNamedType(type: GraphQLOutputType): GraphQLNamedOutputType;
export function getNamedType(type: GraphQLType): GraphQLNamedType;
export function getNamedType(
  type: Maybe<GraphQLType>,
): GraphQLNamedType | undefined;
export function getNamedType(
  type: Maybe<GraphQLType>,
): GraphQLNamedType | undefined {
  if (type) {
    let unwrappedType = type;
    while (isWrappingType(unwrappedType)) {
      unwrappedType = unwrappedType.ofType;
    }
    return unwrappedType;
  }
}

/**
 * Used while defining GraphQL types to allow for circular references in
 * otherwise immutable type definitions.
 */
export type ThunkReadonlyArray<T> = (() => ReadonlyArray<T>) | ReadonlyArray<T>;
export type ThunkObjMap<T> = (() => ObjMap<T>) | ObjMap<T>;

export function resolveReadonlyArrayThunk<T>(
  thunk: ThunkReadonlyArray<T>,
): ReadonlyArray<T> {
  return typeof thunk === 'function' ? thunk() : thunk;
}

export function resolveObjMapThunk<T>(thunk: ThunkObjMap<T>): ObjMap<T> {
  return typeof thunk === 'function' ? thunk() : thunk;
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
 * If a type's serialize function returns `null` or does not return a value
 * (i.e. it returns `undefined`) then an error will be raised and a `null`
 * value will be returned in the response. It is always better to validate
 *
 * Example:
 *
 * ```ts
 * const OddType = new GraphQLScalarType({
 *   name: 'Odd',
 *   serialize(value) {
 *     if (!Number.isFinite(value)) {
 *       throw new Error(
 *         `Scalar "Odd" cannot represent "${value}" since it is not a finite number.`,
 *       );
 *     }
 *
 *     if (value % 2 === 0) {
 *       throw new Error(`Scalar "Odd" cannot represent "${value}" since it is even.`);
 *     }
 *     return value;
 *   }
 * });
 * ```
 */
export class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  name: string;
  description: Maybe<string>;
  specifiedByURL: Maybe<string>;
  serialize: GraphQLScalarSerializer<TExternal>;
  parseValue: GraphQLScalarValueParser<TInternal>;
  parseLiteral: GraphQLScalarLiteralParser<TInternal>;
  extensions: Readonly<GraphQLScalarTypeExtensions>;
  astNode: Maybe<ScalarTypeDefinitionNode>;
  extensionASTNodes: ReadonlyArray<ScalarTypeExtensionNode>;

  constructor(config: Readonly<GraphQLScalarTypeConfig<TInternal, TExternal>>) {
    const parseValue =
      config.parseValue ??
      (identityFunc as GraphQLScalarValueParser<TInternal>);

    this.name = assertName(config.name);
    this.description = config.description;
    this.specifiedByURL = config.specifiedByURL;
    this.serialize =
      config.serialize ?? (identityFunc as GraphQLScalarSerializer<TExternal>);
    this.parseValue = parseValue;
    this.parseLiteral =
      config.parseLiteral ??
      ((node, variables) => parseValue(valueFromASTUntyped(node, variables)));
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    devAssert(
      config.specifiedByURL == null ||
        typeof config.specifiedByURL === 'string',
      `${this.name} must provide "specifiedByURL" as a string, ` +
        `but got: ${inspect(config.specifiedByURL)}.`,
    );

    devAssert(
      config.serialize == null || typeof config.serialize === 'function',
      `${this.name} must provide "serialize" function. If this custom Scalar is also used as an input type, ensure "parseValue" and "parseLiteral" functions are also provided.`,
    );

    if (config.parseLiteral) {
      devAssert(
        typeof config.parseValue === 'function' &&
          typeof config.parseLiteral === 'function',
        `${this.name} must provide both "parseValue" and "parseLiteral" functions.`,
      );
    }
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLScalarType';
  }

  toConfig(): GraphQLScalarTypeNormalizedConfig<TInternal, TExternal> {
    return {
      name: this.name,
      description: this.description,
      specifiedByURL: this.specifiedByURL,
      serialize: this.serialize,
      parseValue: this.parseValue,
      parseLiteral: this.parseLiteral,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
    };
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.toString();
  }
}

export type GraphQLScalarSerializer<TExternal> = (
  outputValue: unknown,
) => TExternal;

export type GraphQLScalarValueParser<TInternal> = (
  inputValue: unknown,
) => TInternal;

export type GraphQLScalarLiteralParser<TInternal> = (
  valueNode: ValueNode,
  variables?: Maybe<ObjMap<unknown>>,
) => TInternal;

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

interface GraphQLScalarTypeNormalizedConfig<TInternal, TExternal>
  extends GraphQLScalarTypeConfig<TInternal, TExternal> {
  serialize: GraphQLScalarSerializer<TExternal>;
  parseValue: GraphQLScalarValueParser<TInternal>;
  parseLiteral: GraphQLScalarLiteralParser<TInternal>;
  extensions: Readonly<GraphQLScalarTypeExtensions>;
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
 * ```ts
 * const AddressType = new GraphQLObjectType({
 *   name: 'Address',
 *   fields: {
 *     street: { type: GraphQLString },
 *     number: { type: GraphQLInt },
 *     formatted: {
 *       type: GraphQLString,
 *       resolve(obj) {
 *         return obj.number + ' ' + obj.street
 *       }
 *     }
 *   }
 * });
 * ```
 *
 * When two types need to refer to each other, or a type needs to refer to
 * itself in a field, you can use a function expression (aka a closure or a
 * thunk) to supply the fields lazily.
 *
 * Example:
 *
 * ```ts
 * const PersonType = new GraphQLObjectType({
 *   name: 'Person',
 *   fields: () => ({
 *     name: { type: GraphQLString },
 *     bestFriend: { type: PersonType },
 *   })
 * });
 * ```
 */
export class GraphQLObjectType<TSource = any, TContext = any> {
  name: string;
  description: Maybe<string>;
  isTypeOf: Maybe<GraphQLIsTypeOfFn<TSource, TContext>>;
  extensions: Readonly<GraphQLObjectTypeExtensions<TSource, TContext>>;
  astNode: Maybe<ObjectTypeDefinitionNode>;
  extensionASTNodes: ReadonlyArray<ObjectTypeExtensionNode>;

  private _fields: ThunkObjMap<GraphQLField<TSource, TContext>>;
  private _interfaces: ThunkReadonlyArray<GraphQLInterfaceType>;

  constructor(config: Readonly<GraphQLObjectTypeConfig<TSource, TContext>>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.isTypeOf = config.isTypeOf;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._fields = () => defineFieldMap(config);
    this._interfaces = () => defineInterfaces(config);
    devAssert(
      config.isTypeOf == null || typeof config.isTypeOf === 'function',
      `${this.name} must provide "isTypeOf" as a function, ` +
        `but got: ${inspect(config.isTypeOf)}.`,
    );
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLObjectType';
  }

  getFields(): GraphQLFieldMap<TSource, TContext> {
    if (typeof this._fields === 'function') {
      this._fields = this._fields();
    }
    return this._fields;
  }

  getInterfaces(): ReadonlyArray<GraphQLInterfaceType> {
    if (typeof this._interfaces === 'function') {
      this._interfaces = this._interfaces();
    }
    return this._interfaces;
  }

  toConfig(): GraphQLObjectTypeNormalizedConfig<TSource, TContext> {
    return {
      name: this.name,
      description: this.description,
      interfaces: this.getInterfaces(),
      fields: fieldsToFieldsConfig(this.getFields()),
      isTypeOf: this.isTypeOf,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
    };
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.toString();
  }
}

function defineInterfaces(
  config: Readonly<
    GraphQLObjectTypeConfig<any, any> | GraphQLInterfaceTypeConfig<any, any>
  >,
): ReadonlyArray<GraphQLInterfaceType> {
  const interfaces = resolveReadonlyArrayThunk(config.interfaces ?? []);
  devAssert(
    Array.isArray(interfaces),
    `${config.name} interfaces must be an Array or a function which returns an Array.`,
  );
  return interfaces;
}

function defineFieldMap<TSource, TContext>(
  config: Readonly<
    | GraphQLObjectTypeConfig<TSource, TContext>
    | GraphQLInterfaceTypeConfig<TSource, TContext>
  >,
): GraphQLFieldMap<TSource, TContext> {
  const fieldMap = resolveObjMapThunk(config.fields);
  devAssert(
    isPlainObj(fieldMap),
    `${config.name} fields must be an object with field names as keys or a function which returns such an object.`,
  );

  return mapValue(fieldMap, (fieldConfig, fieldName) => {
    devAssert(
      isPlainObj(fieldConfig),
      `${config.name}.${fieldName} field config must be an object.`,
    );
    devAssert(
      fieldConfig.resolve == null || typeof fieldConfig.resolve === 'function',
      `${config.name}.${fieldName} field resolver must be a function if ` +
        `provided, but got: ${inspect(fieldConfig.resolve)}.`,
    );

    const argsConfig = fieldConfig.args ?? {};
    devAssert(
      isPlainObj(argsConfig),
      `${config.name}.${fieldName} args must be an object with argument names as keys.`,
    );

    return {
      name: assertName(fieldName),
      description: fieldConfig.description,
      type: fieldConfig.type,
      args: defineArguments(argsConfig),
      resolve: fieldConfig.resolve,
      subscribe: fieldConfig.subscribe,
      deprecationReason: fieldConfig.deprecationReason,
      extensions: toObjMap(fieldConfig.extensions),
      astNode: fieldConfig.astNode,
    };
  });
}

export function defineArguments(
  config: GraphQLFieldConfigArgumentMap,
): ReadonlyArray<GraphQLArgument> {
  return Object.entries(config).map(([argName, argConfig]) => ({
    name: assertName(argName),
    description: argConfig.description,
    type: argConfig.type,
    defaultValue: argConfig.defaultValue,
    deprecationReason: argConfig.deprecationReason,
    extensions: toObjMap(argConfig.extensions),
    astNode: argConfig.astNode,
  }));
}

function isPlainObj(obj: unknown): boolean {
  return isObjectLike(obj) && !Array.isArray(obj);
}

function fieldsToFieldsConfig<TSource, TContext>(
  fields: GraphQLFieldMap<TSource, TContext>,
): GraphQLFieldConfigMap<TSource, TContext> {
  return mapValue(fields, (field) => ({
    description: field.description,
    type: field.type,
    args: argsToArgsConfig(field.args),
    resolve: field.resolve,
    subscribe: field.subscribe,
    deprecationReason: field.deprecationReason,
    extensions: field.extensions,
    astNode: field.astNode,
  }));
}

/**
 * @internal
 */
export function argsToArgsConfig(
  args: ReadonlyArray<GraphQLArgument>,
): GraphQLFieldConfigArgumentMap {
  return keyValMap(
    args,
    (arg) => arg.name,
    (arg) => ({
      description: arg.description,
      type: arg.type,
      defaultValue: arg.defaultValue,
      deprecationReason: arg.deprecationReason,
      extensions: arg.extensions,
      astNode: arg.astNode,
    }),
  );
}

export interface GraphQLObjectTypeConfig<TSource, TContext> {
  name: string;
  description?: Maybe<string>;
  interfaces?: ThunkReadonlyArray<GraphQLInterfaceType>;
  fields: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>;
  isTypeOf?: Maybe<GraphQLIsTypeOfFn<TSource, TContext>>;
  extensions?: Maybe<Readonly<GraphQLObjectTypeExtensions<TSource, TContext>>>;
  astNode?: Maybe<ObjectTypeDefinitionNode>;
  extensionASTNodes?: Maybe<ReadonlyArray<ObjectTypeExtensionNode>>;
}

interface GraphQLObjectTypeNormalizedConfig<TSource, TContext>
  extends GraphQLObjectTypeConfig<any, any> {
  interfaces: ReadonlyArray<GraphQLInterfaceType>;
  fields: GraphQLFieldConfigMap<any, any>;
  extensions: Readonly<GraphQLObjectTypeExtensions<TSource, TContext>>;
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
  TArgs = any,
  TResult = unknown,
> = (
  source: TSource,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult;

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
  readonly variableValues: { [variable: string]: unknown };
  /** @experimental */
  readonly errorPropagation: boolean;
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
export interface GraphQLFieldExtensions<_TSource, _TContext, _TArgs = any> {
  [attributeName: string]: unknown;
}

export interface GraphQLFieldConfig<TSource, TContext, TArgs = any> {
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

export interface GraphQLField<TSource, TContext, TArgs = any> {
  name: string;
  description: Maybe<string>;
  type: GraphQLOutputType;
  args: ReadonlyArray<GraphQLArgument>;
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  deprecationReason: Maybe<string>;
  extensions: Readonly<GraphQLFieldExtensions<TSource, TContext, TArgs>>;
  astNode: Maybe<FieldDefinitionNode>;
}

export interface GraphQLArgument {
  name: string;
  description: Maybe<string>;
  type: GraphQLInputType;
  defaultValue: unknown;
  deprecationReason: Maybe<string>;
  extensions: Readonly<GraphQLArgumentExtensions>;
  astNode: Maybe<InputValueDefinitionNode>;
}

export function isRequiredArgument(arg: GraphQLArgument): boolean {
  // Note: input types cannot be SemanticNullable
  return isNonNullType(arg.type) && arg.defaultValue === undefined;
}

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
 * ```ts
 * const EntityType = new GraphQLInterfaceType({
 *   name: 'Entity',
 *   fields: {
 *     name: { type: GraphQLString }
 *   }
 * });
 * ```
 */
export class GraphQLInterfaceType {
  name: string;
  description: Maybe<string>;
  resolveType: Maybe<GraphQLTypeResolver<any, any>>;
  extensions: Readonly<GraphQLInterfaceTypeExtensions>;
  astNode: Maybe<InterfaceTypeDefinitionNode>;
  extensionASTNodes: ReadonlyArray<InterfaceTypeExtensionNode>;

  private _fields: ThunkObjMap<GraphQLField<any, any>>;
  private _interfaces: ThunkReadonlyArray<GraphQLInterfaceType>;

  constructor(config: Readonly<GraphQLInterfaceTypeConfig<any, any>>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.resolveType = config.resolveType;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._fields = defineFieldMap.bind(undefined, config);
    this._interfaces = defineInterfaces.bind(undefined, config);
    devAssert(
      config.resolveType == null || typeof config.resolveType === 'function',
      `${this.name} must provide "resolveType" as a function, ` +
        `but got: ${inspect(config.resolveType)}.`,
    );
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLInterfaceType';
  }

  getFields(): GraphQLFieldMap<any, any> {
    if (typeof this._fields === 'function') {
      this._fields = this._fields();
    }
    return this._fields;
  }

  getInterfaces(): ReadonlyArray<GraphQLInterfaceType> {
    if (typeof this._interfaces === 'function') {
      this._interfaces = this._interfaces();
    }
    return this._interfaces;
  }

  toConfig(): GraphQLInterfaceTypeNormalizedConfig {
    return {
      name: this.name,
      description: this.description,
      interfaces: this.getInterfaces(),
      fields: fieldsToFieldsConfig(this.getFields()),
      resolveType: this.resolveType,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
    };
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.toString();
  }
}

export interface GraphQLInterfaceTypeConfig<TSource, TContext> {
  name: string;
  description?: Maybe<string>;
  interfaces?: ThunkReadonlyArray<GraphQLInterfaceType>;
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
  interfaces: ReadonlyArray<GraphQLInterfaceType>;
  fields: GraphQLFieldConfigMap<any, any>;
  extensions: Readonly<GraphQLInterfaceTypeExtensions>;
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
 * ```ts
 * const PetType = new GraphQLUnionType({
 *   name: 'Pet',
 *   types: [ DogType, CatType ],
 *   resolveType(value) {
 *     if (value instanceof Dog) {
 *       return DogType;
 *     }
 *     if (value instanceof Cat) {
 *       return CatType;
 *     }
 *   }
 * });
 * ```
 */
export class GraphQLUnionType {
  name: string;
  description: Maybe<string>;
  resolveType: Maybe<GraphQLTypeResolver<any, any>>;
  extensions: Readonly<GraphQLUnionTypeExtensions>;
  astNode: Maybe<UnionTypeDefinitionNode>;
  extensionASTNodes: ReadonlyArray<UnionTypeExtensionNode>;

  private _types: ThunkReadonlyArray<GraphQLObjectType>;

  constructor(config: Readonly<GraphQLUnionTypeConfig<any, any>>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.resolveType = config.resolveType;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._types = defineTypes.bind(undefined, config);
    devAssert(
      config.resolveType == null || typeof config.resolveType === 'function',
      `${this.name} must provide "resolveType" as a function, ` +
        `but got: ${inspect(config.resolveType)}.`,
    );
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLUnionType';
  }

  getTypes(): ReadonlyArray<GraphQLObjectType> {
    if (typeof this._types === 'function') {
      this._types = this._types();
    }
    return this._types;
  }

  toConfig(): GraphQLUnionTypeNormalizedConfig {
    return {
      name: this.name,
      description: this.description,
      types: this.getTypes(),
      resolveType: this.resolveType,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
    };
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.toString();
  }
}

function defineTypes(
  config: Readonly<GraphQLUnionTypeConfig<unknown, unknown>>,
): ReadonlyArray<GraphQLObjectType> {
  const types = resolveReadonlyArrayThunk(config.types);
  devAssert(
    Array.isArray(types),
    `Must provide Array of types or a function which returns such an array for Union ${config.name}.`,
  );
  return types;
}

export interface GraphQLUnionTypeConfig<TSource, TContext> {
  name: string;
  description?: Maybe<string>;
  types: ThunkReadonlyArray<GraphQLObjectType>;
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
  types: ReadonlyArray<GraphQLObjectType>;
  extensions: Readonly<GraphQLUnionTypeExtensions>;
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
 * ```ts
 * const RGBType = new GraphQLEnumType({
 *   name: 'RGB',
 *   values: {
 *     RED: { value: 0 },
 *     GREEN: { value: 1 },
 *     BLUE: { value: 2 }
 *   }
 * });
 * ```
 *
 * Note: If a value is not provided in a definition, the name of the enum value
 * will be used as its internal value.
 */
export class GraphQLEnumType /* <T> */ {
  name: string;
  description: Maybe<string>;
  extensions: Readonly<GraphQLEnumTypeExtensions>;
  astNode: Maybe<EnumTypeDefinitionNode>;
  extensionASTNodes: ReadonlyArray<EnumTypeExtensionNode>;

  private _values:
    | ReadonlyArray<GraphQLEnumValue /* <T> */>
    | (() => GraphQLEnumValueConfigMap);

  private _valueLookup: ReadonlyMap<any /* T */, GraphQLEnumValue> | null;
  private _nameLookup: ObjMap<GraphQLEnumValue> | null;

  constructor(config: Readonly<GraphQLEnumTypeConfig /* <T> */>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._values =
      typeof config.values === 'function'
        ? config.values
        : defineEnumValues(this.name, config.values);
    this._valueLookup = null;
    this._nameLookup = null;
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLEnumType';
  }

  getValues(): ReadonlyArray<GraphQLEnumValue /* <T> */> {
    if (typeof this._values === 'function') {
      this._values = defineEnumValues(this.name, this._values());
    }
    return this._values;
  }

  getValue(name: string): Maybe<GraphQLEnumValue> {
    if (this._nameLookup === null) {
      this._nameLookup = keyMap(this.getValues(), (value) => value.name);
    }
    return this._nameLookup[name];
  }

  serialize(outputValue: unknown /* T */): Maybe<string> {
    if (this._valueLookup === null) {
      this._valueLookup = new Map(
        this.getValues().map((enumValue) => [enumValue.value, enumValue]),
      );
    }
    const enumValue = this._valueLookup.get(outputValue);
    if (enumValue === undefined) {
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent value: ${inspect(outputValue)}`,
      );
    }
    return enumValue.name;
  }

  parseValue(inputValue: unknown): Maybe<any> /* T */ {
    if (typeof inputValue !== 'string') {
      const valueStr = inspect(inputValue);
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent non-string value: ${valueStr}.` +
          didYouMeanEnumValue(this, valueStr),
      );
    }

    const enumValue = this.getValue(inputValue);
    if (enumValue == null) {
      throw new GraphQLError(
        `Value "${inputValue}" does not exist in "${this.name}" enum.` +
          didYouMeanEnumValue(this, inputValue),
      );
    }
    return enumValue.value;
  }

  parseLiteral(
    valueNode: ValueNode,
    _variables: Maybe<ObjMap<unknown>>,
  ): Maybe<any> /* T */ {
    // Note: variables will be resolved to a value before calling this function.
    if (valueNode.kind !== Kind.ENUM) {
      const valueStr = print(valueNode);
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent non-enum value: ${valueStr}.` +
          didYouMeanEnumValue(this, valueStr),
        { nodes: valueNode },
      );
    }

    const enumValue = this.getValue(valueNode.value);
    if (enumValue == null) {
      const valueStr = print(valueNode);
      throw new GraphQLError(
        `Value "${valueStr}" does not exist in "${this.name}" enum.` +
          didYouMeanEnumValue(this, valueStr),
        { nodes: valueNode },
      );
    }
    return enumValue.value;
  }

  toConfig(): GraphQLEnumTypeNormalizedConfig {
    const values = keyValMap(
      this.getValues(),
      (value) => value.name,
      (value) => ({
        description: value.description,
        value: value.value,
        deprecationReason: value.deprecationReason,
        extensions: value.extensions,
        astNode: value.astNode,
      }),
    );

    return {
      name: this.name,
      description: this.description,
      values,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
    };
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.toString();
  }
}

function didYouMeanEnumValue(
  enumType: GraphQLEnumType,
  unknownValueStr: string,
): string {
  const allNames = enumType.getValues().map((value) => value.name);
  const suggestedValues = suggestionList(unknownValueStr, allNames);

  return didYouMean('the enum value', suggestedValues);
}

function defineEnumValues(
  typeName: string,
  valueMap: GraphQLEnumValueConfigMap /* <T> */,
): ReadonlyArray<GraphQLEnumValue /* <T> */> {
  devAssert(
    isPlainObj(valueMap),
    `${typeName} values must be an object with value names as keys.`,
  );
  return Object.entries(valueMap).map(([valueName, valueConfig]) => {
    devAssert(
      isPlainObj(valueConfig),
      `${typeName}.${valueName} must refer to an object with a "value" key ` +
        `representing an internal value but got: ${inspect(valueConfig)}.`,
    );
    return {
      name: assertEnumValueName(valueName),
      description: valueConfig.description,
      value: valueConfig.value !== undefined ? valueConfig.value : valueName,
      deprecationReason: valueConfig.deprecationReason,
      extensions: toObjMap(valueConfig.extensions),
      astNode: valueConfig.astNode,
    };
  });
}

export interface GraphQLEnumTypeConfig {
  name: string;
  description?: Maybe<string>;
  values: ThunkObjMap<GraphQLEnumValueConfig /* <T> */>;
  extensions?: Maybe<Readonly<GraphQLEnumTypeExtensions>>;
  astNode?: Maybe<EnumTypeDefinitionNode>;
  extensionASTNodes?: Maybe<ReadonlyArray<EnumTypeExtensionNode>>;
}

interface GraphQLEnumTypeNormalizedConfig extends GraphQLEnumTypeConfig {
  values: ObjMap<GraphQLEnumValueConfig /* <T> */>;
  extensions: Readonly<GraphQLEnumTypeExtensions>;
  extensionASTNodes: ReadonlyArray<EnumTypeExtensionNode>;
}

export type GraphQLEnumValueConfigMap /* <T> */ =
  ObjMap<GraphQLEnumValueConfig /* <T> */>;

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
  value?: any /* T */;
  deprecationReason?: Maybe<string>;
  extensions?: Maybe<Readonly<GraphQLEnumValueExtensions>>;
  astNode?: Maybe<EnumValueDefinitionNode>;
}

export interface GraphQLEnumValue {
  name: string;
  description: Maybe<string>;
  value: any /* T */;
  deprecationReason: Maybe<string>;
  extensions: Readonly<GraphQLEnumValueExtensions>;
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
 * ```ts
 * const GeoPoint = new GraphQLInputObjectType({
 *   name: 'GeoPoint',
 *   fields: {
 *     lat: { type: new GraphQLNonNull(GraphQLFloat) },
 *     lon: { type: new GraphQLNonNull(GraphQLFloat) },
 *     alt: { type: GraphQLFloat, defaultValue: 0 },
 *   }
 * });
 * ```
 */
export class GraphQLInputObjectType {
  name: string;
  description: Maybe<string>;
  extensions: Readonly<GraphQLInputObjectTypeExtensions>;
  astNode: Maybe<InputObjectTypeDefinitionNode>;
  extensionASTNodes: ReadonlyArray<InputObjectTypeExtensionNode>;
  isOneOf: boolean;

  private _fields: ThunkObjMap<GraphQLInputField>;

  constructor(config: Readonly<GraphQLInputObjectTypeConfig>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];
    this.isOneOf = config.isOneOf ?? false;

    this._fields = defineInputFieldMap.bind(undefined, config);
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLInputObjectType';
  }

  getFields(): GraphQLInputFieldMap {
    if (typeof this._fields === 'function') {
      this._fields = this._fields();
    }
    return this._fields;
  }

  toConfig(): GraphQLInputObjectTypeNormalizedConfig {
    const fields = mapValue(this.getFields(), (field) => ({
      description: field.description,
      type: field.type,
      defaultValue: field.defaultValue,
      deprecationReason: field.deprecationReason,
      extensions: field.extensions,
      astNode: field.astNode,
    }));

    return {
      name: this.name,
      description: this.description,
      fields,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
      isOneOf: this.isOneOf,
    };
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.toString();
  }
}

function defineInputFieldMap(
  config: Readonly<GraphQLInputObjectTypeConfig>,
): GraphQLInputFieldMap {
  const fieldMap = resolveObjMapThunk(config.fields);
  devAssert(
    isPlainObj(fieldMap),
    `${config.name} fields must be an object with field names as keys or a function which returns such an object.`,
  );
  return mapValue(fieldMap, (fieldConfig, fieldName) => {
    devAssert(
      !('resolve' in fieldConfig),
      `${config.name}.${fieldName} field has a resolve property, but Input Types cannot define resolvers.`,
    );

    return {
      name: assertName(fieldName),
      description: fieldConfig.description,
      type: fieldConfig.type,
      defaultValue: fieldConfig.defaultValue,
      deprecationReason: fieldConfig.deprecationReason,
      extensions: toObjMap(fieldConfig.extensions),
      astNode: fieldConfig.astNode,
    };
  });
}

export interface GraphQLInputObjectTypeConfig {
  name: string;
  description?: Maybe<string>;
  fields: ThunkObjMap<GraphQLInputFieldConfig>;
  extensions?: Maybe<Readonly<GraphQLInputObjectTypeExtensions>>;
  astNode?: Maybe<InputObjectTypeDefinitionNode>;
  extensionASTNodes?: Maybe<ReadonlyArray<InputObjectTypeExtensionNode>>;
  isOneOf?: boolean;
}

interface GraphQLInputObjectTypeNormalizedConfig
  extends GraphQLInputObjectTypeConfig {
  fields: GraphQLInputFieldConfigMap;
  extensions: Readonly<GraphQLInputObjectTypeExtensions>;
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
  extensions: Readonly<GraphQLInputFieldExtensions>;
  astNode: Maybe<InputValueDefinitionNode>;
}

export function isRequiredInputField(field: GraphQLInputField): boolean {
  // Note: input types cannot be SemanticNullable
  return isNonNullType(field.type) && field.defaultValue === undefined;
}

export type GraphQLInputFieldMap = ObjMap<GraphQLInputField>;
