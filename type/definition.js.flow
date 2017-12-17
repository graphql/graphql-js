/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import instanceOf from '../jsutils/instanceOf';
import invariant from '../jsutils/invariant';
import isInvalid from '../jsutils/isInvalid';
import type { ObjMap } from '../jsutils/ObjMap';
import * as Kind from '../language/kinds';
import { valueFromASTUntyped } from '../utilities/valueFromASTUntyped';
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
  ObjectTypeExtensionNode,
  InterfaceTypeExtensionNode,
  OperationDefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
  ValueNode,
} from '../language/ast';
import type { GraphQLSchema } from './schema';
import { GraphQLList, GraphQLNonNull } from './wrappers';

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

export function isType(type: mixed): boolean %checks {
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

export function assertType(type: mixed): GraphQLType {
  invariant(isType(type), `Expected ${String(type)} to be a GraphQL type.`);
  return (type: any);
}

/**
 * There are predicates for each kind of GraphQL type.
 */

declare function isScalarType(type: mixed): boolean %checks(type instanceof
  GraphQLScalarType);
// eslint-disable-next-line no-redeclare
export function isScalarType(type) {
  return instanceOf(type, GraphQLScalarType);
}

export function assertScalarType(type: mixed): GraphQLScalarType {
  invariant(
    isScalarType(type),
    `Expected ${String(type)} to be a GraphQL Scalar type.`,
  );
  return type;
}

declare function isObjectType(type: mixed): boolean %checks(type instanceof
  GraphQLObjectType);
// eslint-disable-next-line no-redeclare
export function isObjectType(type) {
  return instanceOf(type, GraphQLObjectType);
}

export function assertObjectType(type: mixed): GraphQLObjectType {
  invariant(
    isObjectType(type),
    `Expected ${String(type)} to be a GraphQL Object type.`,
  );
  return type;
}

declare function isInterfaceType(type: mixed): boolean %checks(type instanceof
  GraphQLInterfaceType);
// eslint-disable-next-line no-redeclare
export function isInterfaceType(type) {
  return instanceOf(type, GraphQLInterfaceType);
}

export function assertInterfaceType(type: mixed): GraphQLInterfaceType {
  invariant(
    isInterfaceType(type),
    `Expected ${String(type)} to be a GraphQL Interface type.`,
  );
  return type;
}

declare function isUnionType(type: mixed): boolean %checks(type instanceof
  GraphQLUnionType);
// eslint-disable-next-line no-redeclare
export function isUnionType(type) {
  return instanceOf(type, GraphQLUnionType);
}

export function assertUnionType(type: mixed): GraphQLUnionType {
  invariant(
    isUnionType(type),
    `Expected ${String(type)} to be a GraphQL Union type.`,
  );
  return type;
}

declare function isEnumType(type: mixed): boolean %checks(type instanceof
  GraphQLEnumType);
// eslint-disable-next-line no-redeclare
export function isEnumType(type) {
  return instanceOf(type, GraphQLEnumType);
}

export function assertEnumType(type: mixed): GraphQLEnumType {
  invariant(
    isEnumType(type),
    `Expected ${String(type)} to be a GraphQL Enum type.`,
  );
  return type;
}

declare function isInputObjectType(type: mixed): boolean %checks(type instanceof
  GraphQLInputObjectType);
// eslint-disable-next-line no-redeclare
export function isInputObjectType(type) {
  return instanceOf(type, GraphQLInputObjectType);
}

export function assertInputObjectType(type: mixed): GraphQLInputObjectType {
  invariant(
    isInputObjectType(type),
    `Expected ${String(type)} to be a GraphQL Input Object type.`,
  );
  return type;
}

declare function isListType(type: mixed): boolean %checks(type instanceof
  GraphQLList);
// eslint-disable-next-line no-redeclare
export function isListType(type) {
  return instanceOf(type, GraphQLList);
}

export function assertListType(type: mixed): GraphQLList<any> {
  invariant(
    isListType(type),
    `Expected ${String(type)} to be a GraphQL List type.`,
  );
  return type;
}

declare function isNonNullType(type: mixed): boolean %checks(type instanceof
  GraphQLNonNull);
// eslint-disable-next-line no-redeclare
export function isNonNullType(type) {
  return instanceOf(type, GraphQLNonNull);
}

export function assertNonNullType(type: mixed): GraphQLNonNull<any> {
  invariant(
    isNonNullType(type),
    `Expected ${String(type)} to be a GraphQL Non-Null type.`,
  );
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

export function isInputType(type: mixed): boolean %checks {
  return (
    isScalarType(type) ||
    isEnumType(type) ||
    isInputObjectType(type) ||
    (isWrappingType(type) && isInputType(type.ofType))
  );
}

export function assertInputType(type: mixed): GraphQLInputType {
  invariant(
    isInputType(type),
    `Expected ${String(type)} to be a GraphQL input type.`,
  );
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

export function isOutputType(type: mixed): boolean %checks {
  return (
    isScalarType(type) ||
    isObjectType(type) ||
    isInterfaceType(type) ||
    isUnionType(type) ||
    isEnumType(type) ||
    (isWrappingType(type) && isOutputType(type.ofType))
  );
}

export function assertOutputType(type: mixed): GraphQLOutputType {
  invariant(
    isOutputType(type),
    `Expected ${String(type)} to be a GraphQL output type.`,
  );
  return type;
}

/**
 * These types may describe types which may be leaf values.
 */
export type GraphQLLeafType = GraphQLScalarType | GraphQLEnumType;

export function isLeafType(type: mixed): boolean %checks {
  return isScalarType(type) || isEnumType(type);
}

export function assertLeafType(type: mixed): GraphQLLeafType {
  invariant(
    isLeafType(type),
    `Expected ${String(type)} to be a GraphQL leaf type.`,
  );
  return type;
}

/**
 * These types may describe the parent context of a selection set.
 */
export type GraphQLCompositeType =
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType;

export function isCompositeType(type: mixed): boolean %checks {
  return isObjectType(type) || isInterfaceType(type) || isUnionType(type);
}

export function assertCompositeType(type: mixed): GraphQLCompositeType {
  invariant(
    isCompositeType(type),
    `Expected ${String(type)} to be a GraphQL composite type.`,
  );
  return type;
}

/**
 * These types may describe the parent context of a selection set.
 */
export type GraphQLAbstractType = GraphQLInterfaceType | GraphQLUnionType;

export function isAbstractType(type: mixed): boolean %checks {
  return isInterfaceType(type) || isUnionType(type);
}

export function assertAbstractType(type: mixed): GraphQLAbstractType {
  invariant(
    isAbstractType(type),
    `Expected ${String(type)} to be a GraphQL abstract type.`,
  );
  return type;
}

/**
 * These types wrap and modify other types
 */

export type GraphQLWrappingType = GraphQLList<any> | GraphQLNonNull<any>;

export function isWrappingType(type: mixed): boolean %checks {
  return isListType(type) || isNonNullType(type);
}

export function assertWrappingType(type: mixed): GraphQLWrappingType {
  invariant(
    isWrappingType(type),
    `Expected ${String(type)} to be a GraphQL wrapping type.`,
  );
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

export function isNullableType(type: mixed): boolean %checks {
  return isType(type) && !isNonNullType(type);
}

export function assertNullableType(type: mixed): GraphQLNullableType {
  invariant(
    isNullableType(type),
    `Expected ${String(type)} to be a GraphQL nullable type.`,
  );
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
export type GraphQLNamedType =
  | GraphQLScalarType
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType
  | GraphQLInputObjectType;

export function isNamedType(type: mixed): boolean %checks {
  return (
    isScalarType(type) ||
    isObjectType(type) ||
    isInterfaceType(type) ||
    isUnionType(type) ||
    isEnumType(type) ||
    isInputObjectType(type)
  );
}

export function assertNamedType(type: mixed): GraphQLNamedType {
  invariant(
    isNamedType(type),
    `Expected ${String(type)} to be a GraphQL named type.`,
  );
  return type;
}

/* eslint-disable no-redeclare */
declare function getNamedType(type: void | null): void;
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
export type Thunk<+T> = (() => T) | T;

function resolveThunk<+T>(thunk: Thunk<T>): T {
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
  astNode: ?ScalarTypeDefinitionNode;

  _scalarConfig: GraphQLScalarTypeConfig<*, *>;

  constructor(config: GraphQLScalarTypeConfig<*, *>): void {
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this._scalarConfig = config;
    invariant(typeof config.name === 'string', 'Must provide name.');
    invariant(
      typeof config.serialize === 'function',
      `${this.name} must provide "serialize" function. If this custom Scalar ` +
        'is also used as an input type, ensure "parseValue" and "parseLiteral" ' +
        'functions are also provided.',
    );
    if (config.parseValue || config.parseLiteral) {
      invariant(
        typeof config.parseValue === 'function' &&
          typeof config.parseLiteral === 'function',
        `${this.name} must provide both "parseValue" and "parseLiteral" ` +
          'functions.',
      );
    }
  }

  // Serializes an internal value to include in a response.
  serialize(value: mixed): mixed {
    const serializer = this._scalarConfig.serialize;
    return serializer(value);
  }

  // Parses an externally provided value to use as an input.
  parseValue(value: mixed): mixed {
    const parser = this._scalarConfig.parseValue;
    if (isInvalid(value)) {
      return undefined;
    }
    return parser ? parser(value) : value;
  }

  // Parses an externally provided literal value to use as an input.
  parseLiteral(valueNode: ValueNode, variables: ?ObjMap<mixed>): mixed {
    const parser = this._scalarConfig.parseLiteral;
    return parser
      ? parser(valueNode, variables)
      : valueFromASTUntyped(valueNode, variables);
  }

  toString(): string {
    return this.name;
  }

  toJSON: () => string;
  inspect: () => string;
}

// Also provide toJSON and inspect aliases for toString.
GraphQLScalarType.prototype.toJSON = GraphQLScalarType.prototype.inspect =
  GraphQLScalarType.prototype.toString;

export type GraphQLScalarTypeConfig<TInternal, TExternal> = {
  name: string,
  description?: ?string,
  astNode?: ?ScalarTypeDefinitionNode,
  serialize: (value: mixed) => ?TExternal,
  parseValue?: (value: mixed) => ?TInternal,
  parseLiteral?: (
    valueNode: ValueNode,
    variables: ?ObjMap<mixed>,
  ) => ?TInternal,
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
  astNode: ?ObjectTypeDefinitionNode;
  extensionASTNodes: ?$ReadOnlyArray<ObjectTypeExtensionNode>;
  isTypeOf: ?GraphQLIsTypeOfFn<*, *>;

  _typeConfig: GraphQLObjectTypeConfig<*, *>;
  _fields: GraphQLFieldMap<*, *>;
  _interfaces: Array<GraphQLInterfaceType>;

  constructor(config: GraphQLObjectTypeConfig<*, *>): void {
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes;
    this.isTypeOf = config.isTypeOf;
    this._typeConfig = config;
    invariant(typeof config.name === 'string', 'Must provide name.');
    if (config.isTypeOf) {
      invariant(
        typeof config.isTypeOf === 'function',
        `${this.name} must provide "isTypeOf" as a function.`,
      );
    }
  }

  getFields(): GraphQLFieldMap<*, *> {
    return (
      this._fields ||
      (this._fields = defineFieldMap(this, this._typeConfig.fields))
    );
  }

  getInterfaces(): Array<GraphQLInterfaceType> {
    return (
      this._interfaces ||
      (this._interfaces = defineInterfaces(this, this._typeConfig.interfaces))
    );
  }

  toString(): string {
    return this.name;
  }

  toJSON: () => string;
  inspect: () => string;
}

// Also provide toJSON and inspect aliases for toString.
GraphQLObjectType.prototype.toJSON = GraphQLObjectType.prototype.inspect =
  GraphQLObjectType.prototype.toString;

function defineInterfaces(
  type: GraphQLObjectType,
  interfacesThunk: Thunk<?Array<GraphQLInterfaceType>>,
): Array<GraphQLInterfaceType> {
  const interfaces = resolveThunk(interfacesThunk) || [];
  invariant(
    Array.isArray(interfaces),
    `${type.name} interfaces must be an Array or a function which returns ` +
      'an Array.',
  );
  return interfaces;
}

function defineFieldMap<TSource, TContext>(
  type: GraphQLNamedType,
  fieldsThunk: Thunk<GraphQLFieldConfigMap<TSource, TContext>>,
): GraphQLFieldMap<TSource, TContext> {
  const fieldMap = resolveThunk(fieldsThunk) || {};
  invariant(
    isPlainObj(fieldMap),
    `${type.name} fields must be an object with field names as keys or a ` +
      'function which returns such an object.',
  );

  const resultFieldMap = Object.create(null);
  Object.keys(fieldMap).forEach(fieldName => {
    const fieldConfig = fieldMap[fieldName];
    invariant(
      isPlainObj(fieldConfig),
      `${type.name}.${fieldName} field config must be an object`,
    );
    invariant(
      !fieldConfig.hasOwnProperty('isDeprecated'),
      `${type.name}.${fieldName} should provide "deprecationReason" instead ` +
        'of "isDeprecated".',
    );
    const field = {
      ...fieldConfig,
      isDeprecated: Boolean(fieldConfig.deprecationReason),
      name: fieldName,
    };
    invariant(
      isValidResolver(field.resolve),
      `${type.name}.${fieldName} field resolver must be a function if ` +
        `provided, but got: ${String(field.resolve)}.`,
    );
    const argsConfig = fieldConfig.args;
    if (!argsConfig) {
      field.args = [];
    } else {
      invariant(
        isPlainObj(argsConfig),
        `${type.name}.${fieldName} args must be an object with argument ` +
          'names as keys.',
      );
      field.args = Object.keys(argsConfig).map(argName => {
        const arg = argsConfig[argName];
        return {
          name: argName,
          description: arg.description === undefined ? null : arg.description,
          type: arg.type,
          defaultValue: arg.defaultValue,
          astNode: arg.astNode,
        };
      });
    }
    resultFieldMap[fieldName] = field;
  });
  return resultFieldMap;
}

function isPlainObj(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj);
}

// If a resolver is defined, it must be a function.
function isValidResolver(resolver: mixed): boolean {
  return resolver == null || typeof resolver === 'function';
}

export type GraphQLObjectTypeConfig<TSource, TContext> = {
  name: string,
  interfaces?: Thunk<?Array<GraphQLInterfaceType>>,
  fields: Thunk<GraphQLFieldConfigMap<TSource, TContext>>,
  isTypeOf?: ?GraphQLIsTypeOfFn<TSource, TContext>,
  description?: ?string,
  astNode?: ?ObjectTypeDefinitionNode,
  extensionASTNodes?: ?$ReadOnlyArray<ObjectTypeExtensionNode>,
};

export type GraphQLTypeResolver<TSource, TContext> = (
  value: TSource,
  context: TContext,
  info: GraphQLResolveInfo,
) => ?GraphQLObjectType | string | Promise<?GraphQLObjectType | string>;

export type GraphQLIsTypeOfFn<TSource, TContext> = (
  source: TSource,
  context: TContext,
  info: GraphQLResolveInfo,
) => boolean | Promise<boolean>;

export type GraphQLFieldResolver<TSource, TContext> = (
  source: TSource,
  args: { [argument: string]: any },
  context: TContext,
  info: GraphQLResolveInfo,
) => mixed;

export type GraphQLResolveInfo = {|
  +fieldName: string,
  +fieldNodes: $ReadOnlyArray<FieldNode>,
  +returnType: GraphQLOutputType,
  +parentType: GraphQLObjectType,
  +path: ResponsePath,
  +schema: GraphQLSchema,
  +fragments: ObjMap<FragmentDefinitionNode>,
  +rootValue: mixed,
  +operation: OperationDefinitionNode,
  +variableValues: { [variable: string]: mixed },
|};

export type ResponsePath = {|
  +prev: ResponsePath | void,
  +key: string | number,
|};

export type GraphQLFieldConfig<TSource, TContext> = {
  type: GraphQLOutputType,
  args?: GraphQLFieldConfigArgumentMap,
  resolve?: GraphQLFieldResolver<TSource, TContext>,
  subscribe?: GraphQLFieldResolver<TSource, TContext>,
  deprecationReason?: ?string,
  description?: ?string,
  astNode?: ?FieldDefinitionNode,
};

export type GraphQLFieldConfigArgumentMap = ObjMap<GraphQLArgumentConfig>;

export type GraphQLArgumentConfig = {
  type: GraphQLInputType,
  defaultValue?: mixed,
  description?: ?string,
  astNode?: ?InputValueDefinitionNode,
};

export type GraphQLFieldConfigMap<TSource, TContext> = ObjMap<
  GraphQLFieldConfig<TSource, TContext>,
>;

export type GraphQLField<TSource, TContext> = {
  name: string,
  description: ?string,
  type: GraphQLOutputType,
  args: Array<GraphQLArgument>,
  resolve?: GraphQLFieldResolver<TSource, TContext>,
  subscribe?: GraphQLFieldResolver<TSource, TContext>,
  isDeprecated?: boolean,
  deprecationReason?: ?string,
  astNode?: ?FieldDefinitionNode,
};

export type GraphQLArgument = {
  name: string,
  type: GraphQLInputType,
  defaultValue?: mixed,
  description?: ?string,
  astNode?: ?InputValueDefinitionNode,
};

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
  astNode: ?InterfaceTypeDefinitionNode;
  extensionASTNodes: ?$ReadOnlyArray<InterfaceTypeExtensionNode>;
  resolveType: ?GraphQLTypeResolver<*, *>;

  _typeConfig: GraphQLInterfaceTypeConfig<*, *>;
  _fields: GraphQLFieldMap<*, *>;

  constructor(config: GraphQLInterfaceTypeConfig<*, *>): void {
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes;
    this.resolveType = config.resolveType;
    this._typeConfig = config;
    invariant(typeof config.name === 'string', 'Must provide name.');
    if (config.resolveType) {
      invariant(
        typeof config.resolveType === 'function',
        `${this.name} must provide "resolveType" as a function.`,
      );
    }
  }

  getFields(): GraphQLFieldMap<*, *> {
    return (
      this._fields ||
      (this._fields = defineFieldMap(this, this._typeConfig.fields))
    );
  }

  toString(): string {
    return this.name;
  }

  toJSON: () => string;
  inspect: () => string;
}

// Also provide toJSON and inspect aliases for toString.
GraphQLInterfaceType.prototype.toJSON = GraphQLInterfaceType.prototype.inspect =
  GraphQLInterfaceType.prototype.toString;

export type GraphQLInterfaceTypeConfig<TSource, TContext> = {
  name: string,
  fields: Thunk<GraphQLFieldConfigMap<TSource, TContext>>,
  /**
   * Optionally provide a custom type resolver function. If one is not provided,
   * the default implementation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: ?GraphQLTypeResolver<TSource, TContext>,
  description?: ?string,
  astNode?: ?InterfaceTypeDefinitionNode,
  extensionASTNodes?: ?$ReadOnlyArray<InterfaceTypeExtensionNode>,
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
  astNode: ?UnionTypeDefinitionNode;
  resolveType: ?GraphQLTypeResolver<*, *>;

  _typeConfig: GraphQLUnionTypeConfig<*, *>;
  _types: Array<GraphQLObjectType>;

  constructor(config: GraphQLUnionTypeConfig<*, *>): void {
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this.resolveType = config.resolveType;
    this._typeConfig = config;
    invariant(typeof config.name === 'string', 'Must provide name.');
    if (config.resolveType) {
      invariant(
        typeof config.resolveType === 'function',
        `${this.name} must provide "resolveType" as a function.`,
      );
    }
  }

  getTypes(): Array<GraphQLObjectType> {
    return (
      this._types || (this._types = defineTypes(this, this._typeConfig.types))
    );
  }

  toString(): string {
    return this.name;
  }

  toJSON: () => string;
  inspect: () => string;
}

// Also provide toJSON and inspect aliases for toString.
GraphQLUnionType.prototype.toJSON = GraphQLUnionType.prototype.inspect =
  GraphQLUnionType.prototype.toString;

function defineTypes(
  unionType: GraphQLUnionType,
  typesThunk: Thunk<Array<GraphQLObjectType>>,
): Array<GraphQLObjectType> {
  const types = resolveThunk(typesThunk) || [];
  invariant(
    Array.isArray(types),
    'Must provide Array of types or a function which returns ' +
      `such an array for Union ${unionType.name}.`,
  );
  return types;
}

export type GraphQLUnionTypeConfig<TSource, TContext> = {
  name: string,
  types: Thunk<Array<GraphQLObjectType>>,
  /**
   * Optionally provide a custom type resolver function. If one is not provided,
   * the default implementation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: ?GraphQLTypeResolver<TSource, TContext>,
  description?: ?string,
  astNode?: ?UnionTypeDefinitionNode,
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
  astNode: ?EnumTypeDefinitionNode;

  _enumConfig: GraphQLEnumTypeConfig /* <T> */;
  _values: Array<GraphQLEnumValue /* <T> */>;
  _valueLookup: Map<any /* T */, GraphQLEnumValue>;
  _nameLookup: ObjMap<GraphQLEnumValue>;

  constructor(config: GraphQLEnumTypeConfig /* <T> */): void {
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this._enumConfig = config;
    invariant(typeof config.name === 'string', 'Must provide name.');
  }

  getValues(): Array<GraphQLEnumValue /* <T> */> {
    return (
      this._values ||
      (this._values = defineEnumValues(this, this._enumConfig.values))
    );
  }

  getValue(name: string): ?GraphQLEnumValue {
    return this._getNameLookup()[name];
  }

  serialize(value: any /* T */): ?string {
    const enumValue = this._getValueLookup().get(value);
    if (enumValue) {
      return enumValue.name;
    }
  }

  parseValue(value: mixed): ?any /* T */ {
    if (typeof value === 'string') {
      const enumValue = this._getNameLookup()[value];
      if (enumValue) {
        return enumValue.value;
      }
    }
  }

  parseLiteral(valueNode: ValueNode, _variables: ?ObjMap<mixed>): ?any /* T */ {
    // Note: variables will be resolved to a value before calling this function.
    if (valueNode.kind === Kind.ENUM) {
      const enumValue = this._getNameLookup()[valueNode.value];
      if (enumValue) {
        return enumValue.value;
      }
    }
  }

  _getValueLookup(): Map<any /* T */, GraphQLEnumValue> {
    if (!this._valueLookup) {
      const lookup = new Map();
      this.getValues().forEach(value => {
        lookup.set(value.value, value);
      });
      this._valueLookup = lookup;
    }
    return this._valueLookup;
  }

  _getNameLookup(): ObjMap<GraphQLEnumValue> {
    if (!this._nameLookup) {
      const lookup = Object.create(null);
      this.getValues().forEach(value => {
        lookup[value.name] = value;
      });
      this._nameLookup = lookup;
    }
    return this._nameLookup;
  }

  toString(): string {
    return this.name;
  }

  toJSON: () => string;
  inspect: () => string;
}

// Also provide toJSON and inspect aliases for toString.
GraphQLEnumType.prototype.toJSON = GraphQLEnumType.prototype.inspect =
  GraphQLEnumType.prototype.toString;

function defineEnumValues(
  type: GraphQLEnumType,
  valueMap: GraphQLEnumValueConfigMap /* <T> */,
): Array<GraphQLEnumValue /* <T> */> {
  invariant(
    isPlainObj(valueMap),
    `${type.name} values must be an object with value names as keys.`,
  );
  return Object.keys(valueMap).map(valueName => {
    const value = valueMap[valueName];
    invariant(
      isPlainObj(value),
      `${type.name}.${valueName} must refer to an object with a "value" key ` +
        `representing an internal value but got: ${String(value)}.`,
    );
    invariant(
      !value.hasOwnProperty('isDeprecated'),
      `${type.name}.${valueName} should provide "deprecationReason" instead ` +
        'of "isDeprecated".',
    );
    return {
      name: valueName,
      description: value.description,
      isDeprecated: Boolean(value.deprecationReason),
      deprecationReason: value.deprecationReason,
      astNode: value.astNode,
      value: value.hasOwnProperty('value') ? value.value : valueName,
    };
  });
}

export type GraphQLEnumTypeConfig /* <T> */ = {
  name: string,
  values: GraphQLEnumValueConfigMap /* <T> */,
  description?: ?string,
  astNode?: ?EnumTypeDefinitionNode,
};

export type GraphQLEnumValueConfigMap /* <T> */ = ObjMap<
  GraphQLEnumValueConfig /* <T> */,
>;

export type GraphQLEnumValueConfig /* <T> */ = {
  value?: any /* T */,
  deprecationReason?: ?string,
  description?: ?string,
  astNode?: ?EnumValueDefinitionNode,
};

export type GraphQLEnumValue /* <T> */ = {
  name: string,
  description: ?string,
  isDeprecated?: boolean,
  deprecationReason: ?string,
  astNode?: ?EnumValueDefinitionNode,
  value: any /* T */,
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
 *         lat: { type: GraphQLNonNull(GraphQLFloat) },
 *         lon: { type: GraphQLNonNull(GraphQLFloat) },
 *         alt: { type: GraphQLFloat, defaultValue: 0 },
 *       }
 *     });
 *
 */
export class GraphQLInputObjectType {
  name: string;
  description: ?string;
  astNode: ?InputObjectTypeDefinitionNode;

  _typeConfig: GraphQLInputObjectTypeConfig;
  _fields: GraphQLInputFieldMap;

  constructor(config: GraphQLInputObjectTypeConfig): void {
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this._typeConfig = config;
    invariant(typeof config.name === 'string', 'Must provide name.');
  }

  getFields(): GraphQLInputFieldMap {
    return this._fields || (this._fields = this._defineFieldMap());
  }

  _defineFieldMap(): GraphQLInputFieldMap {
    const fieldMap: any = resolveThunk(this._typeConfig.fields) || {};
    invariant(
      isPlainObj(fieldMap),
      `${this.name} fields must be an object with field names as keys or a ` +
        'function which returns such an object.',
    );
    const resultFieldMap = Object.create(null);
    Object.keys(fieldMap).forEach(fieldName => {
      const field = {
        ...fieldMap[fieldName],
        name: fieldName,
      };
      invariant(
        !field.hasOwnProperty('resolve'),
        `${this.name}.${fieldName} field type has a resolve property, but ` +
          'Input Types cannot define resolvers.',
      );
      resultFieldMap[fieldName] = field;
    });
    return resultFieldMap;
  }

  toString(): string {
    return this.name;
  }

  toJSON: () => string;
  inspect: () => string;
}

// Also provide toJSON and inspect aliases for toString.
GraphQLInputObjectType.prototype.toJSON =
  GraphQLInputObjectType.prototype.toString;
GraphQLInputObjectType.prototype.inspect =
  GraphQLInputObjectType.prototype.toString;

export type GraphQLInputObjectTypeConfig = {
  name: string,
  fields: Thunk<GraphQLInputFieldConfigMap>,
  description?: ?string,
  astNode?: ?InputObjectTypeDefinitionNode,
};

export type GraphQLInputFieldConfig = {
  type: GraphQLInputType,
  defaultValue?: mixed,
  description?: ?string,
  astNode?: ?InputValueDefinitionNode,
};

export type GraphQLInputFieldConfigMap = ObjMap<GraphQLInputFieldConfig>;

export type GraphQLInputField = {
  name: string,
  type: GraphQLInputType,
  defaultValue?: mixed,
  description?: ?string,
  astNode?: ?InputValueDefinitionNode,
};

export type GraphQLInputFieldMap = ObjMap<GraphQLInputField>;
