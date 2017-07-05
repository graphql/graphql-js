/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import invariant from '../jsutils/invariant';
import isNullish from '../jsutils/isNullish';
import * as Kind from '../language/kinds';
import { assertValidName } from '../utilities/assertValidName';
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
  TypeExtensionDefinitionNode,
  OperationDefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
  ValueNode,
} from '../language/ast';
import type { GraphQLSchema } from './schema';


// Predicates & Assertions

/**
 * These are all of the possible kinds of types.
 */
export type GraphQLType =
  GraphQLScalarType |
  GraphQLObjectType |
  GraphQLInterfaceType |
  GraphQLUnionType |
  GraphQLEnumType |
  GraphQLInputObjectType |
  GraphQLList<any> |
  GraphQLNonNull<any>;

export function isType(type: mixed): boolean {
  return (
    type instanceof GraphQLScalarType ||
    type instanceof GraphQLObjectType ||
    type instanceof GraphQLInterfaceType ||
    type instanceof GraphQLUnionType ||
    type instanceof GraphQLEnumType ||
    type instanceof GraphQLInputObjectType ||
    type instanceof GraphQLList ||
    type instanceof GraphQLNonNull
  );
}

export function assertType(type: mixed): GraphQLType {
  invariant(
    isType(type),
    `Expected ${String(type)} to be a GraphQL type.`
  );
  return (type: any);
}

/**
 * These types may be used as input types for arguments and directives.
 */
export type GraphQLInputType =
  GraphQLScalarType |
  GraphQLEnumType |
  GraphQLInputObjectType |
  GraphQLList<GraphQLInputType> |
  GraphQLNonNull<
    GraphQLScalarType |
    GraphQLEnumType |
    GraphQLInputObjectType |
    GraphQLList<GraphQLInputType>
  >;

export function isInputType(type: ?GraphQLType): boolean %checks {
  return (
    type instanceof GraphQLScalarType ||
    type instanceof GraphQLEnumType ||
    type instanceof GraphQLInputObjectType ||
    type instanceof GraphQLNonNull && isInputType(type.ofType) ||
    type instanceof GraphQLList && isInputType(type.ofType)
  );
}

export function assertInputType(type: ?GraphQLType): GraphQLInputType {
  invariant(
    isInputType(type),
    `Expected ${String(type)} to be a GraphQL input type.`
  );
  return type;
}

/**
 * These types may be used as output types as the result of fields.
 */
export type GraphQLOutputType =
  GraphQLScalarType |
  GraphQLObjectType |
  GraphQLInterfaceType |
  GraphQLUnionType |
  GraphQLEnumType |
  GraphQLList<GraphQLOutputType> |
  GraphQLNonNull<
    GraphQLScalarType |
    GraphQLObjectType |
    GraphQLInterfaceType |
    GraphQLUnionType |
    GraphQLEnumType |
    GraphQLList<GraphQLOutputType>
  >;

export function isOutputType(type: ?GraphQLType): boolean %checks {
  return (
    type instanceof GraphQLScalarType ||
    type instanceof GraphQLObjectType ||
    type instanceof GraphQLInterfaceType ||
    type instanceof GraphQLUnionType ||
    type instanceof GraphQLEnumType ||
    type instanceof GraphQLNonNull && isOutputType(type.ofType) ||
    type instanceof GraphQLList && isOutputType(type.ofType)
  );
}

export function assertOutputType(type: ?GraphQLType): GraphQLOutputType {
  invariant(
    isOutputType(type),
    `Expected ${String(type)} to be a GraphQL output type.`,
  );
  return type;
}

/**
 * These types may describe types which may be leaf values.
 */
export type GraphQLLeafType =
  GraphQLScalarType |
  GraphQLEnumType;

export function isLeafType(type: ?GraphQLType): boolean %checks {
  return (
    type instanceof GraphQLScalarType ||
    type instanceof GraphQLEnumType
  );
}

export function assertLeafType(type: ?GraphQLType): GraphQLLeafType {
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
  GraphQLObjectType |
  GraphQLInterfaceType |
  GraphQLUnionType;

export function isCompositeType(type: ?GraphQLType): boolean %checks {
  return (
    type instanceof GraphQLObjectType ||
    type instanceof GraphQLInterfaceType ||
    type instanceof GraphQLUnionType
  );
}

export function assertCompositeType(type: ?GraphQLType): GraphQLCompositeType {
  invariant(
    isCompositeType(type),
    `Expected ${String(type)} to be a GraphQL composite type.`,
  );
  return type;
}

/**
 * These types may describe the parent context of a selection set.
 */
export type GraphQLAbstractType =
  GraphQLInterfaceType |
  GraphQLUnionType;

export function isAbstractType(type: ?GraphQLType): boolean %checks {
  return (
    type instanceof GraphQLInterfaceType ||
    type instanceof GraphQLUnionType
  );
}

export function assertAbstractType(type: ?GraphQLType): GraphQLAbstractType {
  invariant(
    isAbstractType(type),
    `Expected ${String(type)} to be a GraphQL abstract type.`,
  );
  return type;
}

/**
 * These types can all accept null as a value.
 */
export type GraphQLNullableType =
  GraphQLScalarType |
  GraphQLObjectType |
  GraphQLInterfaceType |
  GraphQLUnionType |
  GraphQLEnumType |
  GraphQLInputObjectType |
  GraphQLList<*>;

export function getNullableType<T: GraphQLType>(
  type: ?T
): ?(T & GraphQLNullableType) {
  return type instanceof GraphQLNonNull ? type.ofType : type;
}

/**
 * These named types do not include modifiers like List or NonNull.
 */
export type GraphQLNamedType =
  GraphQLScalarType |
  GraphQLObjectType |
  GraphQLInterfaceType |
  GraphQLUnionType |
  GraphQLEnumType |
  GraphQLInputObjectType;

export function isNamedType(type: ?GraphQLType): boolean %checks {
  return (
    type instanceof GraphQLScalarType ||
    type instanceof GraphQLObjectType ||
    type instanceof GraphQLInterfaceType ||
    type instanceof GraphQLUnionType ||
    type instanceof GraphQLEnumType ||
    type instanceof GraphQLInputObjectType
  );
}

export function assertNamedType(type: ?GraphQLType): GraphQLNamedType {
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
    let unmodifiedType = type;
    while (
      unmodifiedType instanceof GraphQLList ||
      unmodifiedType instanceof GraphQLNonNull
    ) {
      unmodifiedType = unmodifiedType.ofType;
    }
    return unmodifiedType;
  }
}


/**
 * Used while defining GraphQL types to allow for circular references in
 * otherwise immutable type definitions.
 */
export type Thunk<T> = (() => T) | T;

function resolveThunk<T>(thunk: Thunk<T>): T {
  return typeof thunk === 'function' ? thunk() : thunk;
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
  description: ?string;
  astNode: ?ScalarTypeDefinitionNode;

  _scalarConfig: GraphQLScalarTypeConfig<*, *>;

  constructor(config: GraphQLScalarTypeConfig<*, *>): void {
    assertValidName(config.name);
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    invariant(
      typeof config.serialize === 'function',
      `${this.name} must provide "serialize" function. If this custom Scalar ` +
      'is also used as an input type, ensure "parseValue" and "parseLiteral" ' +
      'functions are also provided.'
    );
    if (config.parseValue || config.parseLiteral) {
      invariant(
        typeof config.parseValue === 'function' &&
        typeof config.parseLiteral === 'function',
        `${this.name} must provide both "parseValue" and "parseLiteral" ` +
        'functions.'
      );
    }
    this._scalarConfig = config;
  }

  // Serializes an internal value to include in a response.
  serialize(value: mixed): mixed {
    const serializer = this._scalarConfig.serialize;
    return serializer(value);
  }

  // Determines if an internal value is valid for this type.
  // Equivalent to checking for if the parsedValue is nullish.
  isValidValue(value: mixed): boolean {
    return !isNullish(this.parseValue(value));
  }

  // Parses an externally provided value to use as an input.
  parseValue(value: mixed): mixed {
    const parser = this._scalarConfig.parseValue;
    return parser && !isNullish(value) ? parser(value) : undefined;
  }

  // Determines if an internal value is valid for this type.
  // Equivalent to checking for if the parsedLiteral is nullish.
  isValidLiteral(valueNode: ValueNode): boolean {
    return !isNullish(this.parseLiteral(valueNode));
  }

  // Parses an externally provided literal value to use as an input.
  parseLiteral(valueNode: ValueNode): mixed {
    const parser = this._scalarConfig.parseLiteral;
    return parser ? parser(valueNode) : undefined;
  }

  toString(): string {
    return this.name;
  }

  toJSON: () => string;
  inspect: () => string;
}

// Also provide toJSON and inspect aliases for toString.
GraphQLScalarType.prototype.toJSON =
  GraphQLScalarType.prototype.inspect =
    GraphQLScalarType.prototype.toString;

export type GraphQLScalarTypeConfig<TInternal, TExternal> = {
  name: string;
  description?: ?string;
  astNode?: ?ScalarTypeDefinitionNode;
  serialize: (value: mixed) => ?TExternal;
  parseValue?: (value: mixed) => ?TInternal;
  parseLiteral?: (valueNode: ValueNode) => ?TInternal;
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
  extensionASTNodes: Array<TypeExtensionDefinitionNode>;
  isTypeOf: ?GraphQLIsTypeOfFn<*, *>;

  _typeConfig: GraphQLObjectTypeConfig<*, *>;
  _fields: GraphQLFieldMap<*, *>;
  _interfaces: Array<GraphQLInterfaceType>;

  constructor(config: GraphQLObjectTypeConfig<*, *>): void {
    assertValidName(config.name, config.isIntrospection);
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes || [];
    if (config.isTypeOf) {
      invariant(
        typeof config.isTypeOf === 'function',
        `${this.name} must provide "isTypeOf" as a function.`
      );
    }
    this.isTypeOf = config.isTypeOf;
    this._typeConfig = config;
  }

  getFields(): GraphQLFieldMap<*, *> {
    return this._fields || (this._fields =
      defineFieldMap(this, this._typeConfig.fields)
    );
  }

  getInterfaces(): Array<GraphQLInterfaceType> {
    return this._interfaces || (this._interfaces =
      defineInterfaces(this, this._typeConfig.interfaces)
    );
  }

  toString(): string {
    return this.name;
  }

  toJSON: () => string;
  inspect: () => string;
}

// Also provide toJSON and inspect aliases for toString.
GraphQLObjectType.prototype.toJSON =
  GraphQLObjectType.prototype.inspect =
    GraphQLObjectType.prototype.toString;

function defineInterfaces(
  type: GraphQLObjectType,
  interfacesThunk: Thunk<?Array<GraphQLInterfaceType>>
): Array<GraphQLInterfaceType> {
  const interfaces = resolveThunk(interfacesThunk);
  if (!interfaces) {
    return [];
  }
  invariant(
    Array.isArray(interfaces),
    `${type.name} interfaces must be an Array or a function which returns ` +
    'an Array.'
  );

  const implementedTypeNames = Object.create(null);
  interfaces.forEach(iface => {
    invariant(
      iface instanceof GraphQLInterfaceType,
      `${type.name} may only implement Interface types, it cannot ` +
      `implement: ${String(iface)}.`
    );
    invariant(
      !implementedTypeNames[iface.name],
      `${type.name} may declare it implements ${iface.name} only once.`
    );
    implementedTypeNames[iface.name] = true;
    if (typeof iface.resolveType !== 'function') {
      invariant(
        typeof type.isTypeOf === 'function',
        `Interface Type ${iface.name} does not provide a "resolveType" ` +
        `function and implementing Type ${type.name} does not provide a ` +
        '"isTypeOf" function. There is no way to resolve this implementing ' +
        'type during execution.'
      );
    }
  });
  return interfaces;
}

function defineFieldMap<TSource, TContext>(
  type: GraphQLNamedType,
  fieldsThunk: Thunk<GraphQLFieldConfigMap<TSource, TContext>>
): GraphQLFieldMap<TSource, TContext> {
  const fieldMap = resolveThunk(fieldsThunk);
  invariant(
    isPlainObj(fieldMap),
    `${type.name} fields must be an object with field names as keys or a ` +
    'function which returns such an object.'
  );

  const fieldNames = Object.keys(fieldMap);
  invariant(
    fieldNames.length > 0,
    `${type.name} fields must be an object with field names as keys or a ` +
    'function which returns such an object.'
  );

  const resultFieldMap = Object.create(null);
  fieldNames.forEach(fieldName => {
    assertValidName(fieldName);
    const fieldConfig = fieldMap[fieldName];
    invariant(
      isPlainObj(fieldConfig),
      `${type.name}.${fieldName} field config must be an object`
    );
    invariant(
      !fieldConfig.hasOwnProperty('isDeprecated'),
      `${type.name}.${fieldName} should provide "deprecationReason" instead ` +
      'of "isDeprecated".'
    );
    const field = {
      ...fieldConfig,
      isDeprecated: Boolean(fieldConfig.deprecationReason),
      name: fieldName
    };
    invariant(
      isOutputType(field.type),
      `${type.name}.${fieldName} field type must be Output Type but ` +
      `got: ${String(field.type)}.`
    );
    invariant(
      isValidResolver(field.resolve),
      `${type.name}.${fieldName} field resolver must be a function if ` +
      `provided, but got: ${String(field.resolve)}.`
    );
    const argsConfig = fieldConfig.args;
    if (!argsConfig) {
      field.args = [];
    } else {
      invariant(
        isPlainObj(argsConfig),
        `${type.name}.${fieldName} args must be an object with argument ` +
        'names as keys.'
      );
      field.args = Object.keys(argsConfig).map(argName => {
        assertValidName(argName);
        const arg = argsConfig[argName];
        invariant(
          isInputType(arg.type),
          `${type.name}.${fieldName}(${argName}:) argument type must be ` +
          `Input Type but got: ${String(arg.type)}.`
        );
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
  return (resolver == null || typeof resolver === 'function');
}

export type GraphQLObjectTypeConfig<TSource, TContext> = {
  name: string;
  interfaces?: Thunk<?Array<GraphQLInterfaceType>>;
  fields: Thunk<GraphQLFieldConfigMap<TSource, TContext>>;
  isTypeOf?: ?GraphQLIsTypeOfFn<TSource, TContext>;
  description?: ?string;
  isIntrospection?: boolean;
  astNode?: ?ObjectTypeDefinitionNode;
  extensionASTNodes?: ?Array<TypeExtensionDefinitionNode>;
};

export type GraphQLTypeResolver<TSource, TContext> = (
  value: TSource,
  context: TContext,
  info: GraphQLResolveInfo
) => ?GraphQLObjectType | string | Promise<?GraphQLObjectType | string>;

export type GraphQLIsTypeOfFn<TSource, TContext> = (
  source: TSource,
  context: TContext,
  info: GraphQLResolveInfo
) => boolean | Promise<boolean>;

export type GraphQLFieldResolver<TSource, TContext> = (
  source: TSource,
  args: { [argName: string]: any },
  context: TContext,
  info: GraphQLResolveInfo
) => mixed;

export type GraphQLResolveInfo = {
  fieldName: string;
  fieldNodes: Array<FieldNode>;
  returnType: GraphQLOutputType;
  parentType: GraphQLCompositeType;
  path: ResponsePath;
  schema: GraphQLSchema;
  fragments: { [fragmentName: string]: FragmentDefinitionNode };
  rootValue: mixed;
  operation: OperationDefinitionNode;
  variableValues: { [variableName: string]: mixed };
};

export type ResponsePath = { prev: ResponsePath, key: string | number } | void;

export type GraphQLFieldConfig<TSource, TContext> = {
  type: GraphQLOutputType;
  args?: GraphQLFieldConfigArgumentMap;
  resolve?: GraphQLFieldResolver<TSource, TContext>;
  subscribe?: GraphQLFieldResolver<TSource, TContext>;
  deprecationReason?: ?string;
  description?: ?string;
  astNode?: ?FieldDefinitionNode;
};

export type GraphQLFieldConfigArgumentMap = {
  [argName: string]: GraphQLArgumentConfig;
};

export type GraphQLArgumentConfig = {
  type: GraphQLInputType;
  defaultValue?: mixed;
  description?: ?string;
  astNode?: ?InputValueDefinitionNode;
};

export type GraphQLFieldConfigMap<TSource, TContext> = {
  [fieldName: string]: GraphQLFieldConfig<TSource, TContext>;
};

export type GraphQLField<TSource, TContext> = {
  name: string;
  description: ?string;
  type: GraphQLOutputType;
  args: Array<GraphQLArgument>;
  resolve?: GraphQLFieldResolver<TSource, TContext>;
  subscribe?: GraphQLFieldResolver<TSource, TContext>;
  isDeprecated?: boolean;
  deprecationReason?: ?string;
  astNode?: ?FieldDefinitionNode;
};

export type GraphQLArgument = {
  name: string;
  type: GraphQLInputType;
  defaultValue?: mixed;
  description?: ?string;
  astNode?: ?InputValueDefinitionNode;
};

export type GraphQLFieldMap<TSource, TContext> = {
  [fieldName: string]: GraphQLField<TSource, TContext>;
};



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
  resolveType: ?GraphQLTypeResolver<*, *>;

  _typeConfig: GraphQLInterfaceTypeConfig<*, *>;
  _fields: GraphQLFieldMap<*, *>;

  constructor(config: GraphQLInterfaceTypeConfig<*, *>): void {
    assertValidName(config.name);
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    if (config.resolveType) {
      invariant(
        typeof config.resolveType === 'function',
        `${this.name} must provide "resolveType" as a function.`
      );
    }
    this.resolveType = config.resolveType;
    this._typeConfig = config;
  }

  getFields(): GraphQLFieldMap<*, *> {
    return this._fields ||
      (this._fields = defineFieldMap(this, this._typeConfig.fields));
  }

  toString(): string {
    return this.name;
  }

  toJSON: () => string;
  inspect: () => string;
}

// Also provide toJSON and inspect aliases for toString.
GraphQLInterfaceType.prototype.toJSON =
  GraphQLInterfaceType.prototype.inspect =
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
  _possibleTypeNames: {[typeName: string]: boolean};

  constructor(config: GraphQLUnionTypeConfig<*, *>): void {
    assertValidName(config.name);
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    if (config.resolveType) {
      invariant(
        typeof config.resolveType === 'function',
        `${this.name} must provide "resolveType" as a function.`
      );
    }
    this.resolveType = config.resolveType;
    this._typeConfig = config;
  }

  getTypes(): Array<GraphQLObjectType> {
    return this._types || (this._types =
      defineTypes(this, this._typeConfig.types)
    );
  }

  toString(): string {
    return this.name;
  }

  toJSON: () => string;
  inspect: () => string;
}

// Also provide toJSON and inspect aliases for toString.
GraphQLUnionType.prototype.toJSON =
  GraphQLUnionType.prototype.inspect =
    GraphQLUnionType.prototype.toString;

function defineTypes(
  unionType: GraphQLUnionType,
  typesThunk: Thunk<Array<GraphQLObjectType>>
): Array<GraphQLObjectType> {
  const types = resolveThunk(typesThunk);

  invariant(
    Array.isArray(types) && types.length > 0,
    'Must provide Array of types or a function which returns ' +
    `such an array for Union ${unionType.name}.`
  );
  const includedTypeNames = Object.create(null);
  types.forEach(objType => {
    invariant(
      objType instanceof GraphQLObjectType,
      `${unionType.name} may only contain Object types, it cannot contain: ` +
      `${String(objType)}.`
    );
    invariant(
      !includedTypeNames[objType.name],
      `${unionType.name} can include ${objType.name} type only once.`
    );
    includedTypeNames[objType.name] = true;
    if (typeof unionType.resolveType !== 'function') {
      invariant(
        typeof objType.isTypeOf === 'function',
        `Union type "${unionType.name}" does not provide a "resolveType" ` +
        `function and possible type "${objType.name}" does not provide an ` +
        '"isTypeOf" function. There is no way to resolve this possible type ' +
        'during execution.'
      );
    }
  });

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
  resolveType?: ?GraphQLTypeResolver<TSource, TContext>;
  description?: ?string;
  astNode?: ?UnionTypeDefinitionNode;
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
export class GraphQLEnumType/* <T> */ {
  name: string;
  description: ?string;
  astNode: ?EnumTypeDefinitionNode;

  _enumConfig: GraphQLEnumTypeConfig/* <T> */;
  _values: Array<GraphQLEnumValue/* <T> */>;
  _valueLookup: Map<any/* T */, GraphQLEnumValue>;
  _nameLookup: { [valueName: string]: GraphQLEnumValue };

  constructor(config: GraphQLEnumTypeConfig/* <T> */): void {
    this.name = config.name;
    assertValidName(config.name, config.isIntrospection);
    this.description = config.description;
    this.astNode = config.astNode;
    this._values = defineEnumValues(this, config.values);
    this._enumConfig = config;
  }

  getValues(): Array<GraphQLEnumValue/* <T> */> {
    return this._values;
  }

  getValue(name: string): ?GraphQLEnumValue {
    return this._getNameLookup()[name];
  }

  serialize(value: any/* T */): ?string {
    const enumValue = this._getValueLookup().get(value);
    return enumValue ? enumValue.name : null;
  }

  isValidValue(value: mixed): boolean {
    return typeof value === 'string' &&
      this._getNameLookup()[value] !== undefined;
  }

  parseValue(value: mixed): ?any/* T */ {
    if (typeof value === 'string') {
      const enumValue = this._getNameLookup()[value];
      if (enumValue) {
        return enumValue.value;
      }
    }
  }

  isValidLiteral(valueNode: ValueNode): boolean {
    return valueNode.kind === Kind.ENUM &&
      this._getNameLookup()[valueNode.value] !== undefined;
  }

  parseLiteral(valueNode: ValueNode): ?any/* T */ {
    if (valueNode.kind === Kind.ENUM) {
      const enumValue = this._getNameLookup()[valueNode.value];
      if (enumValue) {
        return enumValue.value;
      }
    }
  }

  _getValueLookup(): Map<any/* T */, GraphQLEnumValue> {
    if (!this._valueLookup) {
      const lookup = new Map();
      this.getValues().forEach(value => {
        lookup.set(value.value, value);
      });
      this._valueLookup = lookup;
    }
    return this._valueLookup;
  }

  _getNameLookup(): { [valueName: string]: GraphQLEnumValue } {
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
GraphQLEnumType.prototype.toJSON =
  GraphQLEnumType.prototype.inspect =
    GraphQLEnumType.prototype.toString;

function defineEnumValues(
  type: GraphQLEnumType,
  valueMap: GraphQLEnumValueConfigMap/* <T> */
): Array<GraphQLEnumValue/* <T> */> {
  invariant(
    isPlainObj(valueMap),
    `${type.name} values must be an object with value names as keys.`
  );
  const valueNames = Object.keys(valueMap);
  invariant(
    valueNames.length > 0,
    `${type.name} values must be an object with value names as keys.`
  );
  return valueNames.map(valueName => {
    assertValidName(valueName);
    invariant(
      [ 'true', 'false', 'null' ].indexOf(valueName) === -1,
      `Name "${valueName}" can not be used as an Enum value.`
    );

    const value = valueMap[valueName];
    invariant(
      isPlainObj(value),
      `${type.name}.${valueName} must refer to an object with a "value" key ` +
      `representing an internal value but got: ${String(value)}.`
    );
    invariant(
      !value.hasOwnProperty('isDeprecated'),
      `${type.name}.${valueName} should provide "deprecationReason" instead ` +
      'of "isDeprecated".'
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

export type GraphQLEnumTypeConfig/* <T> */ = {
  name: string;
  values: GraphQLEnumValueConfigMap/* <T> */;
  description?: ?string;
  astNode?: ?EnumTypeDefinitionNode;
  isIntrospection?: boolean;
};

export type GraphQLEnumValueConfigMap/* <T> */ = {
  [valueName: string]: GraphQLEnumValueConfig/* <T> */;
};

export type GraphQLEnumValueConfig/* <T> */ = {
  value?: any/* T */;
  deprecationReason?: ?string;
  description?: ?string;
  astNode?: ?EnumValueDefinitionNode;
};

export type GraphQLEnumValue/* <T> */ = {
  name: string;
  description: ?string;
  isDeprecated?: boolean;
  deprecationReason: ?string;
  astNode?: ?EnumValueDefinitionNode;
  value: any/* T */;
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
  astNode: ?InputObjectTypeDefinitionNode;

  _typeConfig: GraphQLInputObjectTypeConfig;
  _fields: GraphQLInputFieldMap;

  constructor(config: GraphQLInputObjectTypeConfig): void {
    assertValidName(config.name);
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this._typeConfig = config;
  }

  getFields(): GraphQLInputFieldMap {
    return this._fields || (this._fields = this._defineFieldMap());
  }

  _defineFieldMap(): GraphQLInputFieldMap {
    const fieldMap: any = resolveThunk(this._typeConfig.fields);
    invariant(
      isPlainObj(fieldMap),
      `${this.name} fields must be an object with field names as keys or a ` +
      'function which returns such an object.'
    );
    const fieldNames = Object.keys(fieldMap);
    invariant(
      fieldNames.length > 0,
      `${this.name} fields must be an object with field names as keys or a ` +
      'function which returns such an object.'
    );
    const resultFieldMap = Object.create(null);
    fieldNames.forEach(fieldName => {
      assertValidName(fieldName);
      const field = {
        ...fieldMap[fieldName],
        name: fieldName
      };
      invariant(
        isInputType(field.type),
        `${this.name}.${fieldName} field type must be Input Type but ` +
        `got: ${String(field.type)}.`
      );
      invariant(
        field.resolve == null,
        `${this.name}.${fieldName} field type has a resolve property, but ` +
        'Input Types cannot define resolvers.'
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
  GraphQLInputObjectType.prototype.inspect =
    GraphQLInputObjectType.prototype.toString;

export type GraphQLInputObjectTypeConfig = {
  name: string;
  fields: Thunk<GraphQLInputFieldConfigMap>;
  description?: ?string;
  astNode?: ?InputObjectTypeDefinitionNode;
};

export type GraphQLInputFieldConfig = {
  type: GraphQLInputType;
  defaultValue?: mixed;
  description?: ?string;
  astNode?: ?InputValueDefinitionNode;
};

export type GraphQLInputFieldConfigMap = {
  [fieldName: string]: GraphQLInputFieldConfig;
};

export type GraphQLInputField = {
  name: string;
  type: GraphQLInputType;
  defaultValue?: mixed;
  description?: ?string;
  astNode?: ?InputValueDefinitionNode;
};

export type GraphQLInputFieldMap = {
  [fieldName: string]: GraphQLInputField;
};



/**
 * List Modifier
 *
 * A list is a kind of type marker, a wrapping type which points to another
 * type. Lists are often created within the context of defining the fields of
 * an object type.
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
export class GraphQLList<T: GraphQLType> {
  ofType: T;

  constructor(type: T): void {
    invariant(
      isType(type),
      `Can only create List of a GraphQLType but got: ${String(type)}.`
    );
    this.ofType = type;
  }

  toString(): string {
    return '[' + String(this.ofType) + ']';
  }

  toJSON: () => string;
  inspect: () => string;
}

// Also provide toJSON and inspect aliases for toString.
GraphQLList.prototype.toJSON =
  GraphQLList.prototype.inspect =
    GraphQLList.prototype.toString;


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
export class GraphQLNonNull<T: GraphQLNullableType> {
  ofType: T;

  constructor(type: T): void {
    invariant(
      isType(type) && !(type instanceof GraphQLNonNull),
      'Can only create NonNull of a Nullable GraphQLType but got: ' +
      `${String(type)}.`
    );
    this.ofType = type;
  }

  toString(): string {
    return this.ofType.toString() + '!';
  }

  toJSON: () => string;
  inspect: () => string;
}

// Also provide toJSON and inspect aliases for toString.
GraphQLNonNull.prototype.toJSON =
  GraphQLNonNull.prototype.inspect =
    GraphQLNonNull.prototype.toString;
