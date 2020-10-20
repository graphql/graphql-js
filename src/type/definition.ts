import type { Path } from '../jsutils/Path';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import type {
  ObjMap,
  ReadOnlyObjMap,
  ReadOnlyObjMapLike,
} from '../jsutils/ObjMap';
import { inspect } from '../jsutils/inspect';
import { keyMap } from '../jsutils/keyMap';
import { mapValue } from '../jsutils/mapValue';
import { toObjMap } from '../jsutils/toObjMap';
import { devAssert } from '../jsutils/devAssert';
import { keyValMap } from '../jsutils/keyValMap';
import { instanceOf } from '../jsutils/instanceOf';
import { didYouMean } from '../jsutils/didYouMean';
import { isObjectLike } from '../jsutils/isObjectLike';
import { identityFunc } from '../jsutils/identityFunc';
import { suggestionList } from '../jsutils/suggestionList';

import { GraphQLError } from '../error/GraphQLError';

import { Kind } from '../language/kinds';
import { print } from '../language/printer';
import type {
  ScalarTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode,
  EnumTypeDefinitionNode,
  EnumValueDefinitionNode,
  InputObjectTypeDefinitionNode,
  ScalarTypeExtensionNode,
  ObjectTypeExtensionNode,
  InterfaceTypeExtensionNode,
  UnionTypeExtensionNode,
  EnumTypeExtensionNode,
  InputObjectTypeExtensionNode,
  OperationDefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
  ValueNode,
} from '../language/ast';

import { valueFromASTUntyped } from '../utilities/valueFromASTUntyped';

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
  | GraphQLList<any>
  | GraphQLNonNull<any>;

export function isType(type: unknown): boolean %checks {
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
 * There are predicates for each kind of GraphQL type.
 */

declare function isScalarType(type: unknown): boolean %checks(type instanceof
  GraphQLScalarType);
// eslint-disable-next-line no-redeclare
export function isScalarType(type) {
  return instanceOf(type, GraphQLScalarType);
}

export function assertScalarType(type: unknown): GraphQLScalarType {
  if (!isScalarType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Scalar type.`);
  }
  return type;
}

declare function isObjectType(type: unknown): boolean %checks(type instanceof
  GraphQLObjectType);
// eslint-disable-next-line no-redeclare
export function isObjectType(type) {
  return instanceOf(type, GraphQLObjectType);
}

export function assertObjectType(type: unknown): GraphQLObjectType {
  if (!isObjectType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Object type.`);
  }
  return type;
}

declare function isInterfaceType(type: unknown): boolean %checks(type instanceof
  GraphQLInterfaceType);
// eslint-disable-next-line no-redeclare
export function isInterfaceType(type) {
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

declare function isUnionType(type: unknown): boolean %checks(type instanceof
  GraphQLUnionType);
// eslint-disable-next-line no-redeclare
export function isUnionType(type) {
  return instanceOf(type, GraphQLUnionType);
}

export function assertUnionType(type: unknown): GraphQLUnionType {
  if (!isUnionType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Union type.`);
  }
  return type;
}

declare function isEnumType(type: unknown): boolean %checks(type instanceof
  GraphQLEnumType);
// eslint-disable-next-line no-redeclare
export function isEnumType(type) {
  return instanceOf(type, GraphQLEnumType);
}

export function assertEnumType(type: unknown): GraphQLEnumType {
  if (!isEnumType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Enum type.`);
  }
  return type;
}

declare function isInputObjectType(type: unknown): boolean %checks(type instanceof
  GraphQLInputObjectType);
// eslint-disable-next-line no-redeclare
export function isInputObjectType(type) {
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

declare function isListType(type: unknown): boolean %checks(type instanceof
  GraphQLList);
// eslint-disable-next-line no-redeclare
export function isListType(type) {
  return instanceOf(type, GraphQLList);
}

export function assertListType(type: unknown): GraphQLList<any> {
  if (!isListType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL List type.`);
  }
  return type;
}

declare function isNonNullType(type: unknown): boolean %checks(type instanceof
  GraphQLNonNull);
// eslint-disable-next-line no-redeclare
export function isNonNullType(type) {
  return instanceOf(type, GraphQLNonNull);
}

export function assertNonNullType(type: unknown): GraphQLNonNull<any> {
  if (!isNonNullType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Non-Null type.`);
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
      | GraphQLList<GraphQLInputType>,
    >;

export function isInputType(type: unknown): boolean %checks {
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
      | GraphQLList<GraphQLOutputType>,
    >;

export function isOutputType(type: unknown): boolean %checks {
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

export function isLeafType(type: unknown): boolean %checks {
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

export function isCompositeType(type: unknown): boolean %checks {
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

export function isAbstractType(type: unknown): boolean %checks {
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
 *     const PersonType = new GraphQLObjectType({
 *       name: 'Person',
 *       fields: () => ({
 *         parents: { type: new GraphQLList(PersonType) },
 *         children: { type: new GraphQLList(PersonType) },
 *       })
 *     })
 *
 */
export class GraphQLList<+T: GraphQLType> {
  readonly ofType: T;

  constructor(ofType: T) {
    devAssert(
      isType(ofType),
      `Expected ${inspect(ofType)} to be a GraphQL type.`,
    );

    this.ofType = ofType;
  }

  toString(): string {
    return '[' + String(this.ofType) + ']';
  }

  toJSON(): string {
    return this.toString();
  }

  // $FlowFixMe[unsupported-syntax] Flow doesn't support computed properties yet
  get [Symbol.toStringTag]() {
    return 'GraphQLList';
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
 *     const RowType = new GraphQLObjectType({
 *       name: 'Row',
 *       fields: () => ({
 *         id: { type: new GraphQLNonNull(GraphQLString) },
 *       })
 *     })
 *
 * Note: the enforcement of non-nullability occurs within the executor.
 */
export class GraphQLNonNull<+T: GraphQLNullableType> {
  readonly ofType: T;

  constructor(ofType: T) {
    devAssert(
      isNullableType(ofType),
      `Expected ${inspect(ofType)} to be a GraphQL nullable type.`,
    );

    this.ofType = ofType;
  }

  toString(): string {
    return String(this.ofType) + '!';
  }

  toJSON(): string {
    return this.toString();
  }

  // $FlowFixMe[unsupported-syntax] Flow doesn't support computed properties yet
  get [Symbol.toStringTag]() {
    return 'GraphQLNonNull';
  }
}

/**
 * These types wrap and modify other types
 */

export type GraphQLWrappingType = GraphQLList<any> | GraphQLNonNull<any>;

export function isWrappingType(type: unknown): boolean %checks {
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
export type GraphQLNullableType =
  | GraphQLScalarType
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType
  | GraphQLInputObjectType
  | GraphQLList<any>;

export function isNullableType(type: unknown): boolean %checks {
  return isType(type) && !isNonNullType(type);
}

export function assertNullableType(type: unknown): GraphQLNullableType {
  if (!isNullableType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL nullable type.`);
  }
  return type;
}

/* eslint-disable no-redeclare */
declare function getNullableType(type: void | null): void;
declare function getNullableType<T: GraphQLNullableType>(type: T): T;
declare function getNullableType<T>(type: GraphQLNonNull<T>): T;
export function getNullableType(type) {
  /* eslint-enable no-redeclare */
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

export function isNamedType(type: unknown): boolean %checks {
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

/* eslint-disable no-redeclare */
declare function getNamedType(type: void | null): void;
declare function getNamedType(type: GraphQLInputType): GraphQLNamedInputType;
declare function getNamedType(type: GraphQLOutputType): GraphQLNamedOutputType;
declare function getNamedType(type: GraphQLType): GraphQLNamedType;
export function getNamedType(type) {
  /* eslint-enable no-redeclare */
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
export type ThunkArray<T> = (() => Array<T>) | Array<T>;
export type ThunkObjMap<T> = (() => ObjMap<T>) | ObjMap<T>;

function resolveArrayThunk<T>(thunk: ThunkArray<T>): Array<T> {
  return typeof thunk === 'function' ? thunk() : thunk;
}

function resolveObjMapThunk<T>(thunk: ThunkObjMap<T>): ObjMap<T> {
  return typeof thunk === 'function' ? thunk() : thunk;
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
  description: ?string;
  specifiedByURL: ?string;
  serialize: GraphQLScalarSerializer<unknown>;
  parseValue: GraphQLScalarValueParser<unknown>;
  parseLiteral: GraphQLScalarLiteralParser<unknown>;
  extensions: ?ReadOnlyObjMap<unknown>;
  astNode: ?ScalarTypeDefinitionNode;
  extensionASTNodes: ReadonlyArray<ScalarTypeExtensionNode>;

  constructor(config: Readonly<GraphQLScalarTypeConfig<unknown, unknown>>) {
    const parseValue = config.parseValue ?? identityFunc;
    this.name = config.name;
    this.description = config.description;
    this.specifiedByURL = config.specifiedByURL;
    this.serialize = config.serialize ?? identityFunc;
    this.parseValue = parseValue;
    this.parseLiteral =
      config.parseLiteral ??
      ((node, variables) => parseValue(valueFromASTUntyped(node, variables)));
    this.extensions = config.extensions && toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    devAssert(typeof config.name === 'string', 'Must provide name.');

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

  toConfig(): GraphQLScalarTypeNormalizedConfig {
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

  // $FlowFixMe[unsupported-syntax] Flow doesn't support computed properties yet
  get [Symbol.toStringTag]() {
    return 'GraphQLScalarType';
  }
}

export type GraphQLScalarSerializer<TExternal> = (
  outputValue: unknown,
) => ?TExternal;

export type GraphQLScalarValueParser<TInternal> = (
  inputValue: unknown,
) => ?TInternal;

export type GraphQLScalarLiteralParser<TInternal> = (
  valueNode: ValueNode,
  variables: ?ObjMap<unknown>,
) => ?TInternal;

export type GraphQLScalarTypeConfig<TInternal, TExternal> = {
  name: string;
  description?: ?string;
  specifiedByURL?: ?string;
  // Serializes an internal value to include in a response.
  serialize?: GraphQLScalarSerializer<TExternal>;
  // Parses an externally provided value to use as an input.
  parseValue?: GraphQLScalarValueParser<TInternal>;
  // Parses an externally provided literal value to use as an input.
  parseLiteral?: GraphQLScalarLiteralParser<TInternal>;
  extensions?: ?ReadOnlyObjMapLike<unknown>;
  astNode?: ?ScalarTypeDefinitionNode;
  extensionASTNodes?: ?ReadonlyArray<ScalarTypeExtensionNode>;
};

type GraphQLScalarTypeNormalizedConfig = {
  ...GraphQLScalarTypeConfig<unknown, unknown>;
  serialize: GraphQLScalarSerializer<unknown>;
  parseValue: GraphQLScalarValueParser<unknown>;
  parseLiteral: GraphQLScalarLiteralParser<unknown>;
  extensions: ?ReadOnlyObjMap<unknown>;
  extensionASTNodes: ReadonlyArray<ScalarTypeExtensionNode>;
};

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
export class GraphQLObjectType {
  name: string;
  description: ?string;
  isTypeOf: ?GraphQLIsTypeOfFn<any, any>;
  extensions: ?ReadOnlyObjMap<unknown>;
  astNode: ?ObjectTypeDefinitionNode;
  extensionASTNodes: ReadonlyArray<ObjectTypeExtensionNode>;

  _fields: ThunkObjMap<GraphQLField<any, any>>;
  _interfaces: ThunkArray<GraphQLInterfaceType>;

  constructor(config: Readonly<GraphQLObjectTypeConfig<any, any>>) {
    this.name = config.name;
    this.description = config.description;
    this.isTypeOf = config.isTypeOf;
    this.extensions = config.extensions && toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._fields = defineFieldMap.bind(undefined, config);
    this._interfaces = defineInterfaces.bind(undefined, config);
    devAssert(typeof config.name === 'string', 'Must provide name.');
    devAssert(
      config.isTypeOf == null || typeof config.isTypeOf === 'function',
      `${this.name} must provide "isTypeOf" as a function, ` +
        `but got: ${inspect(config.isTypeOf)}.`,
    );
  }

  getFields(): GraphQLFieldMap<any, any> {
    if (typeof this._fields === 'function') {
      this._fields = this._fields();
    }
    return this._fields;
  }

  getInterfaces(): Array<GraphQLInterfaceType> {
    if (typeof this._interfaces === 'function') {
      this._interfaces = this._interfaces();
    }
    return this._interfaces;
  }

  toConfig(): GraphQLObjectTypeNormalizedConfig {
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

  // $FlowFixMe[unsupported-syntax] Flow doesn't support computed properties yet
  get [Symbol.toStringTag]() {
    return 'GraphQLObjectType';
  }
}

function defineInterfaces(
  config: Readonly<
    | GraphQLObjectTypeConfig<unknown, unknown>
    | GraphQLInterfaceTypeConfig<unknown, unknown>,
  >,
): Array<GraphQLInterfaceType> {
  const interfaces = resolveArrayThunk(config.interfaces ?? []);
  devAssert(
    Array.isArray(interfaces),
    `${config.name} interfaces must be an Array or a function which returns an Array.`,
  );
  return interfaces;
}

function defineFieldMap<TSource, TContext>(
  config: Readonly<
    | GraphQLObjectTypeConfig<TSource, TContext>
    | GraphQLInterfaceTypeConfig<TSource, TContext>,
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
      name: fieldName,
      description: fieldConfig.description,
      type: fieldConfig.type,
      args: defineArguments(argsConfig),
      resolve: fieldConfig.resolve,
      subscribe: fieldConfig.subscribe,
      deprecationReason: fieldConfig.deprecationReason,
      extensions: fieldConfig.extensions && toObjMap(fieldConfig.extensions),
      astNode: fieldConfig.astNode,
    };
  });
}

export function defineArguments(
  config: GraphQLFieldConfigArgumentMap,
): ReadonlyArray<GraphQLArgument> {
  return Object.entries(config).map(([argName, argConfig]) => ({
    name: argName,
    description: argConfig.description,
    type: argConfig.type,
    defaultValue: argConfig.defaultValue,
    deprecationReason: argConfig.deprecationReason,
    extensions: argConfig.extensions && toObjMap(argConfig.extensions),
    astNode: argConfig.astNode,
  }));
}

function isPlainObj(obj: unknown): boolean {
  return isObjectLike(obj) && !Array.isArray(obj);
}

function fieldsToFieldsConfig(
  fields: GraphQLFieldMap<unknown, unknown>,
): GraphQLFieldConfigMap<unknown, unknown> {
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

export type GraphQLObjectTypeConfig<TSource, TContext> = {
  name: string;
  description?: ?string;
  interfaces?: ThunkArray<GraphQLInterfaceType>;
  fields: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>;
  isTypeOf?: ?GraphQLIsTypeOfFn<TSource, TContext>;
  extensions?: ?ReadOnlyObjMapLike<unknown>;
  astNode?: ?ObjectTypeDefinitionNode;
  extensionASTNodes?: ?ReadonlyArray<ObjectTypeExtensionNode>;
};

type GraphQLObjectTypeNormalizedConfig = {
  ...GraphQLObjectTypeConfig<any, any>;
  interfaces: Array<GraphQLInterfaceType>;
  fields: GraphQLFieldConfigMap<any, any>;
  extensions: ?ReadOnlyObjMap<unknown>;
  extensionASTNodes: ReadonlyArray<ObjectTypeExtensionNode>;
};

/**
 * Note: returning GraphQLObjectType is deprecated and will be removed in v16.0.0
 */
export type GraphQLTypeResolver<TSource, TContext> = (
  value: TSource,
  context: TContext,
  info: GraphQLResolveInfo,
  abstractType: GraphQLAbstractType,
) => PromiseOrValue<string | void>;

export type GraphQLIsTypeOfFn<TSource, TContext> = (
  source: TSource,
  context: TContext,
  info: GraphQLResolveInfo,
) => PromiseOrValue<boolean>;

export type GraphQLFieldResolver<
  TSource,
  TContext,
  TArgs = { [argument: string]: any; ... },
> = (
  source: TSource,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => unknown;

export type GraphQLResolveInfo = {
  readonly fieldName: string;
  readonly fieldNodes: ReadonlyArray<FieldNode>;
  readonly returnType: GraphQLOutputType;
  readonly parentType: GraphQLObjectType;
  readonly path: Path;
  readonly schema: GraphQLSchema;
  readonly fragments: ObjMap<FragmentDefinitionNode>;
  readonly rootValue: unknown;
  readonly operation: OperationDefinitionNode;
  readonly variableValues: { [variable: string]: unknown; ... };
};

export type GraphQLFieldConfig<
  TSource,
  TContext,
  TArgs = { [argument: string]: any; ... },
> = {
  description?: ?string;
  type: GraphQLOutputType;
  args?: GraphQLFieldConfigArgumentMap;
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  deprecationReason?: ?string;
  extensions?: ?ReadOnlyObjMapLike<unknown>;
  astNode?: ?FieldDefinitionNode;
};

export type GraphQLFieldConfigArgumentMap = ObjMap<GraphQLArgumentConfig>;

export type GraphQLArgumentConfig = {
  description?: ?string;
  type: GraphQLInputType;
  defaultValue?: unknown;
  extensions?: ?ReadOnlyObjMapLike<unknown>;
  deprecationReason?: ?string;
  astNode?: ?InputValueDefinitionNode;
};

export type GraphQLFieldConfigMap<TSource, TContext> = ObjMap<
  GraphQLFieldConfig<TSource, TContext>,
>;

export type GraphQLField<
  TSource,
  TContext,
  TArgs = { [argument: string]: any; ... },
> = {
  name: string;
  description: ?string;
  type: GraphQLOutputType;
  args: Array<GraphQLArgument>;
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  deprecationReason: ?string;
  extensions: ?ReadOnlyObjMap<unknown>;
  astNode: ?FieldDefinitionNode;
};

export type GraphQLArgument = {
  name: string;
  description: ?string;
  type: GraphQLInputType;
  defaultValue: unknown;
  deprecationReason: ?string;
  extensions: ?ReadOnlyObjMap<unknown>;
  astNode: ?InputValueDefinitionNode;
};

export function isRequiredArgument(arg: GraphQLArgument): boolean %checks {
  return isNonNullType(arg.type) && arg.defaultValue === undefined;
}

export type GraphQLFieldMap<TSource, TContext> = ObjMap<
  GraphQLField<TSource, TContext>,
>;

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
  description: ?string;
  resolveType: ?GraphQLTypeResolver<any, any>;
  extensions: ?ReadOnlyObjMap<unknown>;
  astNode: ?InterfaceTypeDefinitionNode;
  extensionASTNodes: ReadonlyArray<InterfaceTypeExtensionNode>;

  _fields: ThunkObjMap<GraphQLField<any, any>>;
  _interfaces: ThunkArray<GraphQLInterfaceType>;

  constructor(config: Readonly<GraphQLInterfaceTypeConfig<any, any>>) {
    this.name = config.name;
    this.description = config.description;
    this.resolveType = config.resolveType;
    this.extensions = config.extensions && toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._fields = defineFieldMap.bind(undefined, config);
    this._interfaces = defineInterfaces.bind(undefined, config);
    devAssert(typeof config.name === 'string', 'Must provide name.');
    devAssert(
      config.resolveType == null || typeof config.resolveType === 'function',
      `${this.name} must provide "resolveType" as a function, ` +
        `but got: ${inspect(config.resolveType)}.`,
    );
  }

  getFields(): GraphQLFieldMap<any, any> {
    if (typeof this._fields === 'function') {
      this._fields = this._fields();
    }
    return this._fields;
  }

  getInterfaces(): Array<GraphQLInterfaceType> {
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

  // $FlowFixMe[unsupported-syntax] Flow doesn't support computed properties yet
  get [Symbol.toStringTag]() {
    return 'GraphQLInterfaceType';
  }
}

export type GraphQLInterfaceTypeConfig<TSource, TContext> = {
  name: string;
  description?: ?string;
  interfaces?: ThunkArray<GraphQLInterfaceType>;
  fields: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>;
  /**
   * Optionally provide a custom type resolver function. If one is not provided,
   * the default implementation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: ?GraphQLTypeResolver<TSource, TContext>;
  extensions?: ?ReadOnlyObjMapLike<unknown>;
  astNode?: ?InterfaceTypeDefinitionNode;
  extensionASTNodes?: ?ReadonlyArray<InterfaceTypeExtensionNode>;
};

export type GraphQLInterfaceTypeNormalizedConfig = {
  ...GraphQLInterfaceTypeConfig<any, any>;
  interfaces: Array<GraphQLInterfaceType>;
  fields: GraphQLFieldConfigMap<any, any>;
  extensions: ?ReadOnlyObjMap<unknown>;
  extensionASTNodes: ReadonlyArray<InterfaceTypeExtensionNode>;
};

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
  description: ?string;
  resolveType: ?GraphQLTypeResolver<any, any>;
  extensions: ?ReadOnlyObjMap<unknown>;
  astNode: ?UnionTypeDefinitionNode;
  extensionASTNodes: ReadonlyArray<UnionTypeExtensionNode>;

  _types: ThunkArray<GraphQLObjectType>;

  constructor(config: Readonly<GraphQLUnionTypeConfig<any, any>>) {
    this.name = config.name;
    this.description = config.description;
    this.resolveType = config.resolveType;
    this.extensions = config.extensions && toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._types = defineTypes.bind(undefined, config);
    devAssert(typeof config.name === 'string', 'Must provide name.');
    devAssert(
      config.resolveType == null || typeof config.resolveType === 'function',
      `${this.name} must provide "resolveType" as a function, ` +
        `but got: ${inspect(config.resolveType)}.`,
    );
  }

  getTypes(): Array<GraphQLObjectType> {
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

  // $FlowFixMe[unsupported-syntax] Flow doesn't support computed properties yet
  get [Symbol.toStringTag]() {
    return 'GraphQLUnionType';
  }
}

function defineTypes(
  config: Readonly<GraphQLUnionTypeConfig<unknown, unknown>>,
): Array<GraphQLObjectType> {
  const types = resolveArrayThunk(config.types);
  devAssert(
    Array.isArray(types),
    `Must provide Array of types or a function which returns such an array for Union ${config.name}.`,
  );
  return types;
}

export type GraphQLUnionTypeConfig<TSource, TContext> = {
  name: string;
  description?: ?string;
  types: ThunkArray<GraphQLObjectType>;
  /**
   * Optionally provide a custom type resolver function. If one is not provided,
   * the default implementation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: ?GraphQLTypeResolver<TSource, TContext>;
  extensions?: ?ReadOnlyObjMapLike<unknown>;
  astNode?: ?UnionTypeDefinitionNode;
  extensionASTNodes?: ?ReadonlyArray<UnionTypeExtensionNode>;
};

type GraphQLUnionTypeNormalizedConfig = {
  ...GraphQLUnionTypeConfig<any, any>;
  types: Array<GraphQLObjectType>;
  extensions: ?ReadOnlyObjMap<unknown>;
  extensionASTNodes: ReadonlyArray<UnionTypeExtensionNode>;
};

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
export class GraphQLEnumType /* <T> */ {
  name: string;
  description: ?string;
  extensions: ?ReadOnlyObjMap<unknown>;
  astNode: ?EnumTypeDefinitionNode;
  extensionASTNodes: ReadonlyArray<EnumTypeExtensionNode>;

  _values: Array<GraphQLEnumValue /* <T> */>;
  _valueLookup: Map<any /* T */, GraphQLEnumValue>;
  _nameLookup: ObjMap<GraphQLEnumValue>;

  constructor(config: Readonly<GraphQLEnumTypeConfig /* <T> */>) {
    this.name = config.name;
    this.description = config.description;
    this.extensions = config.extensions && toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._values = defineEnumValues(this.name, config.values);
    this._valueLookup = new Map(
      this._values.map((enumValue) => [enumValue.value, enumValue]),
    );
    this._nameLookup = keyMap(this._values, (value) => value.name);

    devAssert(typeof config.name === 'string', 'Must provide name.');
  }

  getValues(): Array<GraphQLEnumValue /* <T> */> {
    return this._values;
  }

  getValue(name: string): ?GraphQLEnumValue {
    return this._nameLookup[name];
  }

  serialize(outputValue: unknown /* T */): ?string {
    const enumValue = this._valueLookup.get(outputValue);
    if (enumValue === undefined) {
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent value: ${inspect(outputValue)}`,
      );
    }
    return enumValue.name;
  }

  parseValue(inputValue: unknown): ?any /* T */ {
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

  parseLiteral(valueNode: ValueNode, _variables: ?ObjMap<unknown>): ?any /* T */ {
    // Note: variables will be resolved to a value before calling this function.
    if (valueNode.kind !== Kind.ENUM) {
      const valueStr = print(valueNode);
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent non-enum value: ${valueStr}.` +
          didYouMeanEnumValue(this, valueStr),
        valueNode,
      );
    }

    const enumValue = this.getValue(valueNode.value);
    if (enumValue == null) {
      const valueStr = print(valueNode);
      throw new GraphQLError(
        `Value "${valueStr}" does not exist in "${this.name}" enum.` +
          didYouMeanEnumValue(this, valueStr),
        valueNode,
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

  // $FlowFixMe[unsupported-syntax] Flow doesn't support computed properties yet
  get [Symbol.toStringTag]() {
    return 'GraphQLEnumType';
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
): Array<GraphQLEnumValue /* <T> */> {
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
      name: valueName,
      description: valueConfig.description,
      value: valueConfig.value !== undefined ? valueConfig.value : valueName,
      deprecationReason: valueConfig.deprecationReason,
      extensions: valueConfig.extensions && toObjMap(valueConfig.extensions),
      astNode: valueConfig.astNode,
    };
  });
}

export type GraphQLEnumTypeConfig /* <T> */ = {
  name: string;
  description?: ?string;
  values: GraphQLEnumValueConfigMap /* <T> */;
  extensions?: ?ReadOnlyObjMapLike<unknown>;
  astNode?: ?EnumTypeDefinitionNode;
  extensionASTNodes?: ?ReadonlyArray<EnumTypeExtensionNode>;
};

type GraphQLEnumTypeNormalizedConfig = {
  ...GraphQLEnumTypeConfig;
  extensions: ?ReadOnlyObjMap<unknown>;
  extensionASTNodes: ReadonlyArray<EnumTypeExtensionNode>;
};

export type GraphQLEnumValueConfigMap /* <T> */ = ObjMap<GraphQLEnumValueConfig /* <T> */>;

export type GraphQLEnumValueConfig /* <T> */ = {
  description?: ?string;
  value?: any /* T */;
  deprecationReason?: ?string;
  extensions?: ?ReadOnlyObjMapLike<unknown>;
  astNode?: ?EnumValueDefinitionNode;
};

export type GraphQLEnumValue /* <T> */ = {
  name: string;
  description: ?string;
  value: any /* T */;
  deprecationReason: ?string;
  extensions: ?ReadOnlyObjMap<unknown>;
  astNode: ?EnumValueDefinitionNode;
};

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
  description: ?string;
  extensions: ?ReadOnlyObjMap<unknown>;
  astNode: ?InputObjectTypeDefinitionNode;
  extensionASTNodes: ReadonlyArray<InputObjectTypeExtensionNode>;

  _fields: ThunkObjMap<GraphQLInputField>;

  constructor(config: Readonly<GraphQLInputObjectTypeConfig>) {
    this.name = config.name;
    this.description = config.description;
    this.extensions = config.extensions && toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._fields = defineInputFieldMap.bind(undefined, config);
    devAssert(typeof config.name === 'string', 'Must provide name.');
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
    };
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.toString();
  }

  // $FlowFixMe[unsupported-syntax] Flow doesn't support computed properties yet
  get [Symbol.toStringTag]() {
    return 'GraphQLInputObjectType';
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
      name: fieldName,
      description: fieldConfig.description,
      type: fieldConfig.type,
      defaultValue: fieldConfig.defaultValue,
      deprecationReason: fieldConfig.deprecationReason,
      extensions: fieldConfig.extensions && toObjMap(fieldConfig.extensions),
      astNode: fieldConfig.astNode,
    };
  });
}

export type GraphQLInputObjectTypeConfig = {
  name: string;
  description?: ?string;
  fields: ThunkObjMap<GraphQLInputFieldConfig>;
  extensions?: ?ReadOnlyObjMapLike<unknown>;
  astNode?: ?InputObjectTypeDefinitionNode;
  extensionASTNodes?: ?ReadonlyArray<InputObjectTypeExtensionNode>;
};

type GraphQLInputObjectTypeNormalizedConfig = {
  ...GraphQLInputObjectTypeConfig;
  fields: GraphQLInputFieldConfigMap;
  extensions: ?ReadOnlyObjMap<unknown>;
  extensionASTNodes: ReadonlyArray<InputObjectTypeExtensionNode>;
};

export type GraphQLInputFieldConfig = {
  description?: ?string;
  type: GraphQLInputType;
  defaultValue?: unknown;
  deprecationReason?: ?string;
  extensions?: ?ReadOnlyObjMapLike<unknown>;
  astNode?: ?InputValueDefinitionNode;
};

export type GraphQLInputFieldConfigMap = ObjMap<GraphQLInputFieldConfig>;

export type GraphQLInputField = {
  name: string;
  description: ?string;
  type: GraphQLInputType;
  defaultValue: unknown;
  deprecationReason: ?string;
  extensions: ?ReadOnlyObjMap<unknown>;
  astNode: ?InputValueDefinitionNode;
};

export function isRequiredInputField(
  field: GraphQLInputField,
): boolean %checks {
  return isNonNullType(field.type) && field.defaultValue === undefined;
}

export type GraphQLInputFieldMap = ObjMap<GraphQLInputField>;