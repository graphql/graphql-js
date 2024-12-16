import { devAssert } from '../jsutils/devAssert.js';
import { didYouMean } from '../jsutils/didYouMean.js';
import { identityFunc } from '../jsutils/identityFunc.js';
import { inspect } from '../jsutils/inspect.js';
import { instanceOf } from '../jsutils/instanceOf.js';
import { keyMap } from '../jsutils/keyMap.js';
import { keyValMap } from '../jsutils/keyValMap.js';
import { mapValue } from '../jsutils/mapValue.js';
import type { Maybe } from '../jsutils/Maybe.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';
import { suggestionList } from '../jsutils/suggestionList.js';
import { toObjMapWithSymbols } from '../jsutils/toObjMap.js';

import { GraphQLError } from '../error/GraphQLError.js';

import type {
  ConstValueNode,
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
} from '../language/ast.js';
import { Kind } from '../language/kinds.js';
import { print } from '../language/printer.js';

import type { GraphQLVariableSignature } from '../execution/getVariableSignature.js';
import type { VariableValues } from '../execution/values.js';

import { valueFromASTUntyped } from '../utilities/valueFromASTUntyped.js';

import { assertEnumValueName, assertName } from './assertName.js';
import type { GraphQLDirective } from './directives.js';
import type { GraphQLSchema } from './schema.js';

// Predicates & Assertions

/**
 * These are all of the possible kinds of types.
 */
export type GraphQLType = GraphQLNamedType | GraphQLWrappingType;

export function isType(type: unknown): type is GraphQLType {
  return (
    isScalarType(type) ||
    isObjectType(type) ||
    isInterfaceType(type) ||
    isUnionType(type) ||
    isEnumType(type) ||
    isInputObjectType(type) ||
    isListType(type) ||
    isNonNullType(type)
  );
}

export function assertType(type: unknown): GraphQLType {
  if (!isType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL type.`);
  }
  return type;
}

/**
 * There are predicates for each GraphQL schema element.
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

export function isField(field: unknown): field is GraphQLField {
  return instanceOf(field, GraphQLField);
}

export function assertField(field: unknown): GraphQLField {
  if (!isField(field)) {
    throw new Error(`Expected ${inspect(field)} to be a GraphQL field.`);
  }
  return field;
}

export function isArgument(arg: unknown): arg is GraphQLArgument {
  return instanceOf(arg, GraphQLArgument);
}

export function assertArgument(arg: unknown): GraphQLArgument {
  if (!isArgument(arg)) {
    throw new Error(`Expected ${inspect(arg)} to be a GraphQL argument.`);
  }
  return arg;
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

export function isEnumValue(value: unknown): value is GraphQLEnumValue {
  return instanceOf(value, GraphQLEnumValue);
}

export function assertEnumValue(value: unknown): GraphQLEnumValue {
  if (!isEnumValue(value)) {
    throw new Error(`Expected ${inspect(value)} to be a GraphQL Enum value.`);
  }
  return value;
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

export function isInputField(field: unknown): field is GraphQLInputField {
  return instanceOf(field, GraphQLInputField);
}

export function assertInputField(field: unknown): GraphQLInputField {
  if (!isInputField(field)) {
    throw new Error(`Expected ${inspect(field)} to be a GraphQL input field.`);
  }
  return field;
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
): type is GraphQLNonNull<GraphQLNullableInputType>;
export function isNonNullType(
  type: GraphQLOutputType,
): type is GraphQLNonNull<GraphQLNullableOutputType>;
export function isNonNullType(
  type: unknown,
): type is GraphQLNonNull<GraphQLNullableType>;
export function isNonNullType(
  type: unknown,
): type is GraphQLNonNull<GraphQLNullableType> {
  return instanceOf(type, GraphQLNonNull);
}

export function assertNonNullType(
  type: unknown,
): GraphQLNonNull<GraphQLNullableType> {
  if (!isNonNullType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Non-Null type.`);
  }
  return type;
}

/**
 * These types may be used as input types for arguments and directives.
 */
export type GraphQLNullableInputType =
  | GraphQLNamedInputType
  | GraphQLList<GraphQLInputType>;

export type GraphQLInputType =
  | GraphQLNullableInputType
  | GraphQLNonNull<GraphQLNullableInputType>;

export function isInputType(type: unknown): type is GraphQLInputType {
  return (
    isScalarType(type) ||
    isEnumType(type) ||
    isInputObjectType(type) ||
    (isWrappingType(type) && isInputType(type.ofType))
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
export type GraphQLNullableOutputType =
  | GraphQLNamedOutputType
  | GraphQLList<GraphQLOutputType>;

export type GraphQLOutputType =
  | GraphQLNullableOutputType
  | GraphQLNonNull<GraphQLNullableOutputType>;

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
export class GraphQLList<T extends GraphQLType>
  implements GraphQLSchemaElement
{
  readonly ofType: T;

  constructor(ofType: T) {
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
export class GraphQLNonNull<T extends GraphQLNullableType>
  implements GraphQLSchemaElement
{
  readonly ofType: T;

  constructor(ofType: T) {
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
 * These types wrap and modify other types
 */

export type GraphQLWrappingType =
  | GraphQLList<GraphQLType>
  | GraphQLNonNull<GraphQLNullableType>;

export function isWrappingType(type: unknown): type is GraphQLWrappingType {
  return isListType(type) || isNonNullType(type);
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
export type GraphQLNullableType = GraphQLNamedType | GraphQLList<GraphQLType>;

export function isNullableType(type: unknown): type is GraphQLNullableType {
  return isType(type) && !isNonNullType(type);
}

export function assertNullableType(type: unknown): GraphQLNullableType {
  if (!isNullableType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL nullable type.`);
  }
  return type;
}

export function getNullableType(type: undefined | null): void;
export function getNullableType<T extends GraphQLNullableType>(
  type: T | GraphQLNonNull<T>,
): T;
export function getNullableType(
  type: Maybe<GraphQLType>,
): GraphQLNullableType | undefined;
export function getNullableType(
  type: Maybe<GraphQLType>,
): GraphQLNullableType | undefined {
  if (type) {
    return isNonNullType(type) ? type.ofType : type;
  }
}

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
 * An interface for all Schema Elements.
 */

export interface GraphQLSchemaElement {
  toString: () => string;
  toJSON: () => string;
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
  [attributeName: string | symbol]: unknown;
}

/**
 * Scalar Type Definition
 *
 * The leaf values of any request and input values to arguments are
 * Scalars (or Enums) and are defined with a name and a series of functions
 * used to parse input from ast or variables and to ensure validity.
 *
 * If a type's coerceOutputValue function returns `null` or does not return a
 * value (i.e. it returns `undefined`) then an error will be raised and a
 * `null` value will be returned in the response. It is always better to
 * validate.
 *
 * Example:
 *
 * ```ts
 * function ensureOdd(value) {
 *   if (!Number.isFinite(value)) {
 *     throw new Error(
 *       `Scalar "Odd" cannot represent "${value}" since it is not a finite number.`,
 *     );
 *   }
 *
 *   if (value % 2 === 0) {
 *     throw new Error(`Scalar "Odd" cannot represent "${value}" since it is even.`);
 *   }
 * }
 *
 * const OddType = new GraphQLScalarType({
 *   name: 'Odd',
 *   coerceOutputValue(value) {
 *     return ensureOdd(value);
 *   },
 *   coerceInputValue(value) {
 *     return ensureOdd(value);
 *   }
 *   valueToLiteral(value) {
 *    return parse(`${ensureOdd(value)`);
 *   }
 * });
 * ```
 *
 * Custom scalars behavior is defined via the following functions:
 *
 *  - coerceOutputValue(value): Implements "Result Coercion". Given an internal value,
 *    produces an external value valid for this type. Returns undefined or
 *    throws an error to indicate invalid values.
 *
 *  - coerceInputValue(value): Implements "Input Coercion" for values. Given an
 *    external value (for example, variable values), produces an internal value
 *    valid for this type. Returns undefined or throws an error to indicate
 *    invalid values.
 *
 *  - coerceInputLiteral(ast): Implements "Input Coercion" for constant literals.
 *    Given an GraphQL literal (AST) (for example, an argument value), produces
 *    an internal value valid for this type. Returns undefined or throws an
 *    error to indicate invalid values.
 *
 *  - valueToLiteral(value): Converts an external value to a GraphQL
 *    literal (AST). Returns undefined or throws an error to indicate
 *    invalid values.
 *
 *  Deprecated, to be removed in v18:
 *
 *  - serialize(value): Implements "Result Coercion". Renamed to
 *    `coerceOutputValue()`.
 *
 *  - parseValue(value): Implements "Input Coercion" for values. Renamed to
 *    `coerceInputValue()`.
 *
 *  - parseLiteral(ast): Implements "Input Coercion" for literals including
 *    non-specified replacement of variables embedded within complex scalars.
 *    Replaced by the combination of the `replaceVariables()` utility and the
 *    `coerceInputLiteral()` method.
 *
 */
export class GraphQLScalarType<TInternal = unknown, TExternal = TInternal>
  implements GraphQLSchemaElement
{
  name: string;
  description: Maybe<string>;
  specifiedByURL: Maybe<string>;
  /** @deprecated use `coerceOutputValue()` instead, `serialize()` will be removed in v18 */
  serialize: GraphQLScalarSerializer<TExternal>;
  /** @deprecated use `coerceInputValue()` instead, `parseValue()` will be removed in v18 */
  parseValue: GraphQLScalarValueParser<TInternal>;
  /** @deprecated use `replaceVariables()` and `coerceInputLiteral()` instead, `parseLiteral()` will be removed in v18 */
  parseLiteral: GraphQLScalarLiteralParser<TInternal>;
  coerceOutputValue: GraphQLScalarOutputValueCoercer<TExternal>;
  coerceInputValue: GraphQLScalarInputValueCoercer<TInternal>;
  coerceInputLiteral: GraphQLScalarInputLiteralCoercer<TInternal> | undefined;
  valueToLiteral: GraphQLScalarValueToLiteral | undefined;
  extensions: Readonly<GraphQLScalarTypeExtensions>;
  astNode: Maybe<ScalarTypeDefinitionNode>;
  extensionASTNodes: ReadonlyArray<ScalarTypeExtensionNode>;

  constructor(config: Readonly<GraphQLScalarTypeConfig<TInternal, TExternal>>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.specifiedByURL = config.specifiedByURL;
    this.serialize =
      config.serialize ??
      config.coerceOutputValue ??
      (identityFunc as GraphQLScalarSerializer<TExternal>);
    this.parseValue =
      config.parseValue ??
      config.coerceInputValue ??
      (identityFunc as GraphQLScalarValueParser<TInternal>);
    this.parseLiteral =
      config.parseLiteral ??
      ((node, variables) =>
        this.coerceInputValue(valueFromASTUntyped(node, variables)));
    this.coerceOutputValue = config.coerceOutputValue ?? this.serialize;
    this.coerceInputValue = config.coerceInputValue ?? this.parseValue;
    this.coerceInputLiteral = config.coerceInputLiteral;
    this.valueToLiteral = config.valueToLiteral;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    if (config.parseLiteral) {
      devAssert(
        typeof config.parseValue === 'function' &&
          typeof config.parseLiteral === 'function',
        `${this.name} must provide both "parseValue" and "parseLiteral" functions.`,
      );
    }

    if (config.coerceInputLiteral) {
      devAssert(
        typeof config.coerceInputValue === 'function' &&
          typeof config.coerceInputLiteral === 'function',
        `${this.name} must provide both "coerceInputValue" and "coerceInputLiteral" functions.`,
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
      coerceOutputValue: this.coerceOutputValue,
      coerceInputValue: this.coerceInputValue,
      coerceInputLiteral: this.coerceInputLiteral,
      valueToLiteral: this.valueToLiteral,
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

/* @deprecated in favor of GraphQLScalarOutputValueCoercer, will be removed in v18 */
export type GraphQLScalarSerializer<TExternal> = (
  outputValue: unknown,
) => TExternal;

export type GraphQLScalarOutputValueCoercer<TExternal> = (
  outputValue: unknown,
) => TExternal;

/* @deprecated in favor of GraphQLScalarInputValueCoercer, will be removed in v18 */
export type GraphQLScalarValueParser<TInternal> = (
  inputValue: unknown,
) => TInternal;

export type GraphQLScalarInputValueCoercer<TInternal> = (
  inputValue: unknown,
) => TInternal;

/* @deprecated in favor of GraphQLScalarInputLiteralCoercer, will be removed in v18 */
export type GraphQLScalarLiteralParser<TInternal> = (
  valueNode: ValueNode,
  variables: Maybe<ObjMap<unknown>>,
) => Maybe<TInternal>;

export type GraphQLScalarInputLiteralCoercer<TInternal> = (
  valueNode: ConstValueNode,
) => Maybe<TInternal>;

export type GraphQLScalarValueToLiteral = (
  inputValue: unknown,
) => ConstValueNode | undefined;

export interface GraphQLScalarTypeConfig<TInternal, TExternal> {
  name: string;
  description?: Maybe<string>;
  specifiedByURL?: Maybe<string>;
  /** Serializes an internal value to include in a response. */
  /** @deprecated use `coerceOutputValue()` instead, `serialize()` will be removed in v18 */
  serialize?: GraphQLScalarSerializer<TExternal> | undefined;
  /** Parses an externally provided value to use as an input. */
  /** @deprecated use `coerceInputValue()` instead, `parseValue()` will be removed in v18 */
  parseValue?: GraphQLScalarValueParser<TInternal> | undefined;
  /** Parses an externally provided literal value to use as an input. */
  /** @deprecated use `replaceVariables()` and `coerceInputLiteral()` instead, `parseLiteral()` will be removed in v18 */
  parseLiteral?: GraphQLScalarLiteralParser<TInternal> | undefined;
  /** Coerces an internal value to include in a response. */
  coerceOutputValue?: GraphQLScalarOutputValueCoercer<TExternal> | undefined;
  /** Coerces an externally provided value to use as an input. */
  coerceInputValue?: GraphQLScalarInputValueCoercer<TInternal> | undefined;
  /** Coerces an externally provided const literal value to use as an input. */
  coerceInputLiteral?: GraphQLScalarInputLiteralCoercer<TInternal> | undefined;
  /** Translates an externally provided value to a literal (AST). */
  valueToLiteral?: GraphQLScalarValueToLiteral | undefined;
  extensions?: Maybe<Readonly<GraphQLScalarTypeExtensions>>;
  astNode?: Maybe<ScalarTypeDefinitionNode>;
  extensionASTNodes?: Maybe<ReadonlyArray<ScalarTypeExtensionNode>>;
}

export interface GraphQLScalarTypeNormalizedConfig<TInternal, TExternal>
  extends GraphQLScalarTypeConfig<TInternal, TExternal> {
  serialize: GraphQLScalarSerializer<TExternal>;
  parseValue: GraphQLScalarValueParser<TInternal>;
  parseLiteral: GraphQLScalarLiteralParser<TInternal>;
  coerceOutputValue: GraphQLScalarOutputValueCoercer<TExternal>;
  coerceInputValue: GraphQLScalarInputValueCoercer<TInternal>;
  coerceInputLiteral: GraphQLScalarInputLiteralCoercer<TInternal> | undefined;
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
  [attributeName: string | symbol]: unknown;
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
export class GraphQLObjectType<TSource = any, TContext = any>
  implements GraphQLSchemaElement
{
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
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];
    this._fields = (defineFieldMap<TSource, TContext>).bind(
      undefined,
      this,
      config.fields,
    );
    this._interfaces = defineInterfaces.bind(undefined, config.interfaces);
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
      fields: mapValue(this.getFields(), (field) => field.toConfig()),
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
  interfaces: Maybe<ThunkReadonlyArray<GraphQLInterfaceType>>,
): ReadonlyArray<GraphQLInterfaceType> {
  return resolveReadonlyArrayThunk(interfaces ?? []);
}

function defineFieldMap<TSource, TContext>(
  parentType:
    | GraphQLObjectType<TSource, TContext>
    | GraphQLInterfaceType<TSource, TContext>,
  fields: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>,
): GraphQLFieldMap<TSource, TContext> {
  const fieldMap = resolveObjMapThunk(fields);

  return mapValue(
    fieldMap,
    (fieldConfig, fieldName) =>
      new GraphQLField(parentType, fieldName, fieldConfig),
  );
}

export interface GraphQLObjectTypeConfig<TSource, TContext> {
  name: string;
  description?: Maybe<string>;
  interfaces?: ThunkReadonlyArray<GraphQLInterfaceType> | undefined;
  fields: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>;
  isTypeOf?: Maybe<GraphQLIsTypeOfFn<TSource, TContext>>;
  extensions?: Maybe<Readonly<GraphQLObjectTypeExtensions<TSource, TContext>>>;
  astNode?: Maybe<ObjectTypeDefinitionNode>;
  extensionASTNodes?: Maybe<ReadonlyArray<ObjectTypeExtensionNode>>;
}

export interface GraphQLObjectTypeNormalizedConfig<TSource, TContext>
  extends GraphQLObjectTypeConfig<any, any> {
  interfaces: ReadonlyArray<GraphQLInterfaceType>;
  fields: GraphQLFieldNormalizedConfigMap<any, any>;
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
  abortSignal: AbortSignal | undefined,
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
  readonly variableValues: VariableValues;
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
  [attributeName: string | symbol]: unknown;
}

export interface GraphQLFieldConfig<TSource, TContext, TArgs = any> {
  description?: Maybe<string>;
  type: GraphQLOutputType;
  args?: GraphQLFieldConfigArgumentMap | undefined;
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs> | undefined;
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs> | undefined;
  deprecationReason?: Maybe<string>;
  extensions?: Maybe<
    Readonly<GraphQLFieldExtensions<TSource, TContext, TArgs>>
  >;
  astNode?: Maybe<FieldDefinitionNode>;
}

export interface GraphQLFieldNormalizedConfig<TSource, TContext, TArgs = any>
  extends GraphQLFieldConfig<TSource, TContext, TArgs> {
  args: GraphQLFieldNormalizedConfigArgumentMap;
  extensions: Readonly<GraphQLFieldExtensions<TSource, TContext, TArgs>>;
}

export type GraphQLFieldConfigArgumentMap = ObjMap<GraphQLArgumentConfig>;

export type GraphQLFieldNormalizedConfigArgumentMap =
  ObjMap<GraphQLArgumentNormalizedConfig>;

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
  [attributeName: string | symbol]: unknown;
}

export interface GraphQLArgumentConfig {
  description?: Maybe<string>;
  type: GraphQLInputType;
  /** @deprecated use default instead, defaultValue will be removed in v18 **/
  defaultValue?: unknown;
  default?: GraphQLDefaultInput | undefined;
  deprecationReason?: Maybe<string>;
  extensions?: Maybe<Readonly<GraphQLArgumentExtensions>>;
  astNode?: Maybe<InputValueDefinitionNode>;
}

export interface GraphQLArgumentNormalizedConfig extends GraphQLArgumentConfig {
  default: GraphQLDefaultInput | undefined;
  extensions: Readonly<GraphQLArgumentExtensions>;
}

export type GraphQLFieldConfigMap<TSource, TContext> = ObjMap<
  GraphQLFieldConfig<TSource, TContext>
>;

export type GraphQLFieldNormalizedConfigMap<TSource, TContext> = ObjMap<
  GraphQLFieldNormalizedConfig<TSource, TContext>
>;

export class GraphQLField<TSource = any, TContext = any, TArgs = any>
  implements GraphQLSchemaElement
{
  parentType:
    | GraphQLObjectType<TSource, TContext>
    | GraphQLInterfaceType<TSource, TContext>
    | undefined;
  name: string;
  description: Maybe<string>;
  type: GraphQLOutputType;
  args: ReadonlyArray<GraphQLArgument>;
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs> | undefined;
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs> | undefined;
  deprecationReason: Maybe<string>;
  extensions: Readonly<GraphQLFieldExtensions<TSource, TContext, TArgs>>;
  astNode: Maybe<FieldDefinitionNode>;

  constructor(
    parentType:
      | GraphQLObjectType<TSource, TContext>
      | GraphQLInterfaceType<TSource, TContext>
      | undefined,
    name: string,
    config: GraphQLFieldConfig<TSource, TContext, TArgs>,
  ) {
    this.parentType = parentType;
    this.name = assertName(name);
    this.description = config.description;
    this.type = config.type;

    const argsConfig = config.args;
    this.args = argsConfig
      ? Object.entries(argsConfig).map(
          ([argName, argConfig]) =>
            new GraphQLArgument(this, argName, argConfig),
        )
      : [];

    this.resolve = config.resolve;
    this.subscribe = config.subscribe;
    this.deprecationReason = config.deprecationReason;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLField';
  }

  toConfig(): GraphQLFieldNormalizedConfig<TSource, TContext, TArgs> {
    return {
      description: this.description,
      type: this.type,
      args: keyValMap(
        this.args,
        (arg) => arg.name,
        (arg) => arg.toConfig(),
      ),
      resolve: this.resolve,
      subscribe: this.subscribe,
      deprecationReason: this.deprecationReason,
      extensions: this.extensions,
      astNode: this.astNode,
    };
  }

  toString(): string {
    return `${this.parentType ?? '<meta>'}.${this.name}`;
  }

  toJSON(): string {
    return this.toString();
  }
}

export class GraphQLArgument implements GraphQLSchemaElement {
  parent: GraphQLField | GraphQLDirective;
  name: string;
  description: Maybe<string>;
  type: GraphQLInputType;
  defaultValue: unknown;
  default: GraphQLDefaultInput | undefined;
  deprecationReason: Maybe<string>;
  extensions: Readonly<GraphQLArgumentExtensions>;
  astNode: Maybe<InputValueDefinitionNode>;

  constructor(
    parent: GraphQLField | GraphQLDirective,
    name: string,
    config: GraphQLArgumentConfig,
  ) {
    this.parent = parent;
    this.name = assertName(name);
    this.description = config.description;
    this.type = config.type;
    this.defaultValue = config.defaultValue;
    this.default = config.default;
    this.deprecationReason = config.deprecationReason;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLArgument';
  }

  toConfig(): GraphQLArgumentNormalizedConfig {
    return {
      description: this.description,
      type: this.type,
      defaultValue: this.defaultValue,
      default: this.default,
      deprecationReason: this.deprecationReason,
      extensions: this.extensions,
      astNode: this.astNode,
    };
  }

  toString(): string {
    return `${this.parent}(${this.name}:)`;
  }

  toJSON(): string {
    return this.toString();
  }
}

export function isRequiredArgument(
  arg: GraphQLArgument | GraphQLVariableSignature,
): boolean {
  return (
    isNonNullType(arg.type) &&
    arg.default === undefined &&
    arg.defaultValue === undefined
  );
}

export type GraphQLFieldMap<TSource, TContext> = ObjMap<
  GraphQLField<TSource, TContext>
>;

export type GraphQLDefaultInput =
  | { value: unknown; literal?: never }
  | { literal: ConstValueNode; value?: never };

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
  [attributeName: string | symbol]: unknown;
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
export class GraphQLInterfaceType<TSource = any, TContext = any>
  implements GraphQLSchemaElement
{
  name: string;
  description: Maybe<string>;
  resolveType: Maybe<GraphQLTypeResolver<TSource, TContext>>;
  extensions: Readonly<GraphQLInterfaceTypeExtensions>;
  astNode: Maybe<InterfaceTypeDefinitionNode>;
  extensionASTNodes: ReadonlyArray<InterfaceTypeExtensionNode>;

  private _fields: ThunkObjMap<GraphQLField<TSource, TContext>>;
  private _interfaces: ThunkReadonlyArray<GraphQLInterfaceType>;

  constructor(config: Readonly<GraphQLInterfaceTypeConfig<TSource, TContext>>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.resolveType = config.resolveType;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];
    this._fields = (defineFieldMap<TSource, TContext>).bind(
      undefined,
      this,
      config.fields,
    );
    this._interfaces = defineInterfaces.bind(undefined, config.interfaces);
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLInterfaceType';
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

  toConfig(): GraphQLInterfaceTypeNormalizedConfig<TSource, TContext> {
    return {
      name: this.name,
      description: this.description,
      interfaces: this.getInterfaces(),
      fields: mapValue(this.getFields(), (field) => field.toConfig()),
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
  interfaces?: ThunkReadonlyArray<GraphQLInterfaceType> | undefined;
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

export interface GraphQLInterfaceTypeNormalizedConfig<TSource, TContext>
  extends GraphQLInterfaceTypeConfig<any, any> {
  interfaces: ReadonlyArray<GraphQLInterfaceType>;
  fields: GraphQLFieldNormalizedConfigMap<TSource, TContext>;
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
  [attributeName: string | symbol]: unknown;
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
export class GraphQLUnionType implements GraphQLSchemaElement {
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
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._types = defineTypes.bind(undefined, config.types);
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
  types: ThunkReadonlyArray<GraphQLObjectType>,
): ReadonlyArray<GraphQLObjectType> {
  return resolveReadonlyArrayThunk(types);
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

export interface GraphQLUnionTypeNormalizedConfig
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
  [attributeName: string | symbol]: unknown;
}

/**
 * Enum Type Definition
 *
 * Some leaf values of requests and input values are Enums. GraphQL coerces
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
export class GraphQLEnumType /* <T> */ implements GraphQLSchemaElement {
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
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._values =
      typeof config.values === 'function'
        ? config.values
        : Object.entries(config.values).map(
            ([valueName, valueConfig]) =>
              new GraphQLEnumValue(this, valueName, valueConfig),
          );
    this._valueLookup = null;
    this._nameLookup = null;
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLEnumType';
  }

  getValues(): ReadonlyArray<GraphQLEnumValue /* <T> */> {
    if (typeof this._values === 'function') {
      this._values = Object.entries(this._values()).map(
        ([valueName, valueConfig]) =>
          new GraphQLEnumValue(this, valueName, valueConfig),
      );
    }
    return this._values;
  }

  getValue(name: string): Maybe<GraphQLEnumValue> {
    if (this._nameLookup === null) {
      this._nameLookup = keyMap(this.getValues(), (value) => value.name);
    }
    return this._nameLookup[name];
  }

  /** @deprecated use `coerceOutputValue()` instead, `serialize()` will be removed in v18 */
  serialize(outputValue: unknown /* T */): Maybe<string> {
    return this.coerceOutputValue(outputValue);
  }

  coerceOutputValue(outputValue: unknown /* T */): Maybe<string> {
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

  /** @deprecated use `coerceInputValue()` instead, `parseValue()` will be removed in v18 */
  parseValue(
    inputValue: unknown,
    hideSuggestions?: Maybe<boolean>,
  ): Maybe<any> /* T */ {
    return this.coerceInputValue(inputValue, hideSuggestions);
  }

  coerceInputValue(
    inputValue: unknown,
    hideSuggestions?: Maybe<boolean>,
  ): Maybe<any> /* T */ {
    if (typeof inputValue !== 'string') {
      const valueStr = inspect(inputValue);
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent non-string value: ${valueStr}.` +
          (hideSuggestions ? '' : didYouMeanEnumValue(this, valueStr)),
      );
    }

    const enumValue = this.getValue(inputValue);
    if (enumValue == null) {
      throw new GraphQLError(
        `Value "${inputValue}" does not exist in "${this.name}" enum.` +
          (hideSuggestions ? '' : didYouMeanEnumValue(this, inputValue)),
      );
    }
    return enumValue.value;
  }

  /** @deprecated use `coerceInputLiteral()` instead, `parseLiteral()` will be removed in v18 */
  parseLiteral(
    valueNode: ValueNode,
    _variables: Maybe<ObjMap<unknown>>,
    hideSuggestions?: Maybe<boolean>,
  ): Maybe<any> /* T */ {
    // Note: variables will be resolved to a value before calling this function.
    return this.coerceInputLiteral(
      valueNode as ConstValueNode,
      hideSuggestions,
    );
  }

  coerceInputLiteral(
    valueNode: ConstValueNode,
    hideSuggestions?: Maybe<boolean>,
  ): Maybe<any> /* T */ {
    if (valueNode.kind !== Kind.ENUM) {
      const valueStr = print(valueNode);
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent non-enum value: ${valueStr}.` +
          (hideSuggestions ? '' : didYouMeanEnumValue(this, valueStr)),
        { nodes: valueNode },
      );
    }

    const enumValue = this.getValue(valueNode.value);
    if (enumValue == null) {
      const valueStr = print(valueNode);
      throw new GraphQLError(
        `Value "${valueStr}" does not exist in "${this.name}" enum.` +
          (hideSuggestions ? '' : didYouMeanEnumValue(this, valueStr)),
        { nodes: valueNode },
      );
    }
    return enumValue.value;
  }

  valueToLiteral(value: unknown): ConstValueNode | undefined {
    if (typeof value === 'string' && this.getValue(value)) {
      return { kind: Kind.ENUM, value };
    }
  }

  toConfig(): GraphQLEnumTypeNormalizedConfig {
    return {
      name: this.name,
      description: this.description,
      values: keyValMap(
        this.getValues(),
        (value) => value.name,
        (value) => value.toConfig(),
      ),
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

export interface GraphQLEnumTypeConfig {
  name: string;
  description?: Maybe<string>;
  values: ThunkObjMap<GraphQLEnumValueConfig /* <T> */>;
  extensions?: Maybe<Readonly<GraphQLEnumTypeExtensions>>;
  astNode?: Maybe<EnumTypeDefinitionNode>;
  extensionASTNodes?: Maybe<ReadonlyArray<EnumTypeExtensionNode>>;
}

export interface GraphQLEnumTypeNormalizedConfig extends GraphQLEnumTypeConfig {
  values: GraphQLEnumValueNormalizedConfigMap;
  extensions: Readonly<GraphQLEnumTypeExtensions>;
  extensionASTNodes: ReadonlyArray<EnumTypeExtensionNode>;
}

export type GraphQLEnumValueConfigMap /* <T> */ =
  ObjMap<GraphQLEnumValueConfig /* <T> */>;

export type GraphQLEnumValueNormalizedConfigMap /* <T> */ =
  ObjMap<GraphQLEnumValueNormalizedConfig /* <T> */>;

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
  [attributeName: string | symbol]: unknown;
}

export interface GraphQLEnumValueConfig {
  description?: Maybe<string>;
  value?: any /* T */;
  deprecationReason?: Maybe<string>;
  extensions?: Maybe<Readonly<GraphQLEnumValueExtensions>>;
  astNode?: Maybe<EnumValueDefinitionNode>;
}

export interface GraphQLEnumValueNormalizedConfig
  extends GraphQLEnumValueConfig {
  extensions: Readonly<GraphQLEnumValueExtensions>;
}

export class GraphQLEnumValue implements GraphQLSchemaElement {
  parentEnum: GraphQLEnumType;
  name: string;
  description: Maybe<string>;
  value: any /* T */;
  deprecationReason: Maybe<string>;
  extensions: Readonly<GraphQLEnumValueExtensions>;
  astNode: Maybe<EnumValueDefinitionNode>;

  constructor(
    parentEnum: GraphQLEnumType,
    name: string,
    config: GraphQLEnumValueConfig,
  ) {
    this.parentEnum = parentEnum;
    this.name = assertEnumValueName(name);
    this.description = config.description;
    this.value = config.value !== undefined ? config.value : name;
    this.deprecationReason = config.deprecationReason;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLEnumValue';
  }

  toConfig(): GraphQLEnumValueNormalizedConfig {
    return {
      description: this.description,
      value: this.value,
      deprecationReason: this.deprecationReason,
      extensions: this.extensions,
      astNode: this.astNode,
    };
  }

  toString(): string {
    return `${this.parentEnum.name}.${this.name}`;
  }

  toJSON(): string {
    return this.toString();
  }
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
  [attributeName: string | symbol]: unknown;
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
export class GraphQLInputObjectType implements GraphQLSchemaElement {
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
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];
    this.isOneOf = config.isOneOf ?? false;

    this._fields = defineInputFieldMap.bind(undefined, this, config.fields);
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
    return {
      name: this.name,
      description: this.description,
      fields: mapValue(this.getFields(), (field) => field.toConfig()),
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
  parentType: GraphQLInputObjectType,
  fields: ThunkObjMap<GraphQLInputFieldConfig>,
): GraphQLInputFieldMap {
  const fieldMap = resolveObjMapThunk(fields);
  return mapValue(
    fieldMap,
    (fieldConfig, fieldName) =>
      new GraphQLInputField(parentType, fieldName, fieldConfig),
  );
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

export interface GraphQLInputObjectTypeNormalizedConfig
  extends GraphQLInputObjectTypeConfig {
  fields: GraphQLInputFieldNormalizedConfigMap;
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
  [attributeName: string | symbol]: unknown;
}

export interface GraphQLInputFieldConfig {
  description?: Maybe<string>;
  type: GraphQLInputType;
  /** @deprecated use default instead, defaultValue will be removed in v18 **/
  defaultValue?: unknown;
  default?: GraphQLDefaultInput | undefined;
  deprecationReason?: Maybe<string>;
  extensions?: Maybe<Readonly<GraphQLInputFieldExtensions>>;
  astNode?: Maybe<InputValueDefinitionNode>;
}

export type GraphQLInputFieldConfigMap = ObjMap<GraphQLInputFieldConfig>;

export interface GraphQLInputFieldNormalizedConfig
  extends GraphQLInputFieldConfig {
  default: GraphQLDefaultInput | undefined;
  extensions: Readonly<GraphQLInputFieldExtensions>;
}

export type GraphQLInputFieldNormalizedConfigMap =
  ObjMap<GraphQLInputFieldNormalizedConfig>;

export class GraphQLInputField implements GraphQLSchemaElement {
  parentType: GraphQLInputObjectType;
  name: string;
  description: Maybe<string>;
  type: GraphQLInputType;
  defaultValue: unknown;
  default: GraphQLDefaultInput | undefined;
  deprecationReason: Maybe<string>;
  extensions: Readonly<GraphQLInputFieldExtensions>;
  astNode: Maybe<InputValueDefinitionNode>;

  constructor(
    parentType: GraphQLInputObjectType,
    name: string,
    config: GraphQLInputFieldConfig,
  ) {
    devAssert(
      !('resolve' in config),
      `${parentType}.${name} field has a resolve property, but Input Types cannot define resolvers.`,
    );

    this.parentType = parentType;
    this.name = assertName(name);
    this.description = config.description;
    this.type = config.type;
    this.defaultValue = config.defaultValue;
    this.default = config.default;
    this.deprecationReason = config.deprecationReason;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLInputField';
  }

  toConfig(): GraphQLInputFieldNormalizedConfig {
    return {
      description: this.description,
      type: this.type,
      defaultValue: this.defaultValue,
      default: this.default,
      deprecationReason: this.deprecationReason,
      extensions: this.extensions,
      astNode: this.astNode,
    };
  }

  toString(): string {
    return `${this.parentType}.${this.name}`;
  }

  toJSON(): string {
    return this.toString();
  }
}

export function isRequiredInputField(field: GraphQLInputField): boolean {
  return (
    isNonNullType(field.type) &&
    field.defaultValue === undefined &&
    field.default === undefined
  );
}

export type GraphQLInputFieldMap = ObjMap<GraphQLInputField>;
