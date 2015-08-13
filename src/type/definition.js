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
import { ENUM } from '../language/kinds';
import type {
  OperationDefinition,
  Field,
  FragmentDefinition,
  Value,
} from '../language/ast';
import type { GraphQLSchema } from './schema';


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
  GraphQLList |
  GraphQLNonNull;

// Predicates

/**
 * These types may be used as input types for arguments and directives.
 */
export type GraphQLInputType =
  GraphQLScalarType |
  GraphQLEnumType |
  GraphQLInputObjectType |
  GraphQLList |
  GraphQLNonNull;

export function isInputType(type: ?GraphQLType): boolean {
  var namedType = getNamedType(type);
  return (
    namedType instanceof GraphQLScalarType ||
    namedType instanceof GraphQLEnumType ||
    namedType instanceof GraphQLInputObjectType
  );
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
  GraphQLList |
  GraphQLNonNull;

export function isOutputType(type: ?GraphQLType): boolean {
  var namedType = getNamedType(type);
  return (
    namedType instanceof GraphQLScalarType ||
    namedType instanceof GraphQLObjectType ||
    namedType instanceof GraphQLInterfaceType ||
    namedType instanceof GraphQLUnionType ||
    namedType instanceof GraphQLEnumType
  );
}

/**
 * These types may describe types which may be leaf values.
 */
export type GraphQLLeafType =
  GraphQLScalarType |
  GraphQLEnumType;

export function isLeafType(type: ?GraphQLType): boolean {
  var namedType = getNamedType(type);
  return (
    namedType instanceof GraphQLScalarType ||
    namedType instanceof GraphQLEnumType
  );
}

/**
 * These types may describe the parent context of a selection set.
 */
export type GraphQLCompositeType =
  GraphQLObjectType |
  GraphQLInterfaceType |
  GraphQLUnionType;

export function isCompositeType(type: ?GraphQLType): boolean {
  return (
    type instanceof GraphQLObjectType ||
    type instanceof GraphQLInterfaceType ||
    type instanceof GraphQLUnionType
  );
}

/**
 * These types may describe the parent context of a selection set.
 */
export type GraphQLAbstractType =
  GraphQLInterfaceType |
  GraphQLUnionType;

export function isAbstractType(type: ?GraphQLType): boolean {
  return (
    type instanceof GraphQLInterfaceType ||
    type instanceof GraphQLUnionType
  );
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
  GraphQLList;

export function getNullableType(type: ?GraphQLType): ?GraphQLNullableType {
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

export function getNamedType(type: ?GraphQLType): ?GraphQLNamedType {
  var unmodifiedType = type;
  while (
    unmodifiedType instanceof GraphQLList ||
    unmodifiedType instanceof GraphQLNonNull
  ) {
    unmodifiedType = unmodifiedType.ofType;
  }
  return unmodifiedType;
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
 *     var OddType = new GraphQLScalarType({
 *       name: 'Odd',
 *       serialize(value) {
 *         return value % 2 === 1 ? value : null;
 *       }
 *     });
 *
 */
export class GraphQLScalarType/* <T> */ {
  name: string;
  description: ?string;

  _scalarConfig: GraphQLScalarTypeConfig/* <T> */;

  constructor(config: GraphQLScalarTypeConfig/* <T> */) {
    invariant(config.name, 'Type must be named.');
    this.name = config.name;
    this.description = config.description;
    invariant(
      typeof config.serialize === 'function',
      `${this} must provide "serialize" function. If this custom Scalar is ` +
      `also used as an input type, ensure "parseValue" and "parseLiteral" ` +
      `functions are also provided.`
    );
    if (config.parseValue || config.parseLiteral) {
      invariant(
        typeof config.parseValue === 'function' &&
        typeof config.parseLiteral === 'function',
        `${this} must provide both "parseValue" and "parseLiteral" functions.`
      );
    }
    this._scalarConfig = config;
  }

  serialize(value: any): ?any/* T */ {
    var serializer = this._scalarConfig.serialize;
    return serializer(value);
  }

  parseValue(value: any): ?any/* T */ {
    var parser = this._scalarConfig.parseValue;
    return parser ? parser(value) : null;
  }

  parseLiteral(valueAST: Value): ?any/* T */ {
    var parser = this._scalarConfig.parseLiteral;
    return parser ? parser(valueAST) : null;
  }

  toString(): string {
    return this.name;
  }
}

export type GraphQLScalarTypeConfig/* <T> */ = {
  name: string;
  description?: ?string;
  serialize: (value: any) => ?any/* T */;
  parseValue: (value: any) => ?any/* T */;
  parseLiteral: (valueAST: Value) => ?any/* T */;
}



/**
 * Object Type Definition
 *
 * Almost all of the GraphQL types you define will be object types. Object types
 * have a name, but most importantly describe their fields.
 *
 * Example:
 *
 *     var AddressType = new GraphQLObjectType({
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
 *     var PersonType = new GraphQLObjectType({
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
  isTypeOf: ?(value: any, info?: GraphQLResolveInfo) => boolean;

  _typeConfig: GraphQLObjectTypeConfig;
  _fields: GraphQLFieldDefinitionMap;
  _interfaces: Array<GraphQLInterfaceType>;

  constructor(config: GraphQLObjectTypeConfig) {
    invariant(config.name, 'Type must be named.');
    this.name = config.name;
    this.description = config.description;
    this.isTypeOf = config.isTypeOf;
    this._typeConfig = config;
    addImplementationToInterfaces(this);
  }

  getFields(): GraphQLFieldDefinitionMap {
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
}

function resolveMaybeThunk<T>(thingOrThunk: T | () => T): T {
  return typeof thingOrThunk === 'function' ? thingOrThunk() : thingOrThunk;
}

function defineInterfaces(
  type: GraphQLObjectType,
  interfacesOrThunk: Array<GraphQLInterfaceType> | ?GraphQLInterfacesThunk
): Array<GraphQLInterfaceType> {
  var interfaces = resolveMaybeThunk(interfacesOrThunk);
  if (!interfaces) {
    return [];
  }
  invariant(
    Array.isArray(interfaces),
    `${type} interfaces must be an Array or a function which returns an Array.`
  );
  interfaces.forEach(iface => {
    invariant(
      iface instanceof GraphQLInterfaceType,
      `${type} may only implement Interface types, it cannot ` +
      `implement: ${iface}.`
    );
    if (typeof iface.resolveType !== 'function') {
      invariant(
        typeof type.isTypeOf === 'function',
        `Interface Type ${iface} does not provide a "resolveType" function ` +
        `and implementing Type ${type} does not provide a "isTypeOf" ` +
        `function. There is no way to resolve this implementing type ` +
        `during execution.`
      );
    }
  });
  return interfaces;
}

function defineFieldMap(
  type: GraphQLNamedType,
  fields: GraphQLFieldConfigMap | GraphQLFieldConfigMapThunk
): GraphQLFieldDefinitionMap {
  var fieldMap: any = resolveMaybeThunk(fields);
  invariant(
    typeof fieldMap === 'object' && !Array.isArray(fieldMap),
    `${type} fields must be an object with field names as keys or a ` +
    `function which returns such an object.`
  );
  var fieldNames = Object.keys(fieldMap);
  invariant(
    fieldNames.length > 0,
    `${type} fields must be an object with field names as keys or a ` +
    `function which returns such an object.`
  );
  fieldNames.forEach(fieldName => {
    var field = fieldMap[fieldName];
    field.name = fieldName;
    invariant(
      isOutputType(field.type),
      `${type}.${fieldName} field type must be Output Type but ` +
      `got: ${field.type}.`
    );
    if (!field.args) {
      field.args = [];
    } else {
      invariant(
        typeof field.args === 'object' && !Array.isArray(field.args),
        `${type}.${fieldName} args must be an object with argument names ` +
        `as keys.`
      );
      field.args = Object.keys(field.args).map(argName => {
        var arg = field.args[argName];
        invariant(
          isInputType(arg.type),
          `${type}.${fieldName}(${argName}:) argument type must be ` +
          `Input Type but got: ${arg.type}.`
        );
        return {
          name: argName,
          description: arg.description === undefined ? null : arg.description,
          type: arg.type,
          defaultValue: arg.defaultValue === undefined ? null : arg.defaultValue
        };
      });
    }
  });
  return fieldMap;
}

/**
 * Update the interfaces to know about this implementation.
 * This is an rare and unfortunate use of mutation in the type definition
 * implementations, but avoids an expensive "getPossibleTypes"
 * implementation for Interface types.
 */
function addImplementationToInterfaces(impl) {
  impl.getInterfaces().forEach(type => {
    type._implementations.push(impl);
  });
}

export type GraphQLObjectTypeConfig = {
  name: string;
  interfaces?: GraphQLInterfacesThunk | Array<GraphQLInterfaceType>;
  fields: GraphQLFieldConfigMapThunk | GraphQLFieldConfigMap;
  isTypeOf?: (value: any, info?: GraphQLResolveInfo) => boolean;
  description?: ?string
}

type GraphQLInterfacesThunk = () => Array<GraphQLInterfaceType>;

type GraphQLFieldConfigMapThunk = () => GraphQLFieldConfigMap;

export type GraphQLFieldResolveFn = (
  source?: any,
  args?: {[argName: string]: any},
  info?: GraphQLResolveInfo
) => any

export type GraphQLResolveInfo = {
  fieldName: string,
  fieldASTs: Array<Field>,
  returnType: GraphQLOutputType,
  parentType: GraphQLCompositeType,
  schema: GraphQLSchema,
  fragments: { [fragmentName: string]: FragmentDefinition },
  rootValue: any,
  operation: OperationDefinition,
  variableValues: { [variableName: string]: any },
}

export type GraphQLFieldConfig = {
  type: GraphQLOutputType;
  args?: GraphQLFieldConfigArgumentMap;
  resolve?: GraphQLFieldResolveFn;
  deprecationReason?: string;
  description?: ?string;
}

export type GraphQLFieldConfigArgumentMap = {
  [argName: string]: GraphQLArgumentConfig;
};

export type GraphQLArgumentConfig = {
  type: GraphQLInputType;
  defaultValue?: any;
}

export type GraphQLFieldConfigMap = {
  [fieldName: string]: GraphQLFieldConfig;
};

export type GraphQLFieldDefinition = {
  name: string;
  description: ?string;
  type: GraphQLOutputType;
  args: Array<GraphQLArgument>;
  resolve?: GraphQLFieldResolveFn;
  deprecationReason?: ?string;
}

export type GraphQLArgument = {
  name: string;
  type: GraphQLInputType;
  defaultValue?: any;
  description?: ?string;
};

export type GraphQLFieldDefinitionMap = {
  [fieldName: string]: GraphQLFieldDefinition;
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
 *     var EntityType = new GraphQLInterfaceType({
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
  resolveType: ?(value: any, info?: GraphQLResolveInfo) => ?GraphQLObjectType;

  _typeConfig: GraphQLInterfaceTypeConfig;
  _fields: GraphQLFieldDefinitionMap;
  _implementations: Array<GraphQLObjectType>;
  _possibleTypeNames: {[typeName: string]: boolean};

  constructor(config: GraphQLInterfaceTypeConfig) {
    invariant(config.name, 'Type must be named.');
    this.name = config.name;
    this.description = config.description;
    this.resolveType = config.resolveType;
    this._typeConfig = config;
    this._implementations = [];
  }

  getFields(): GraphQLFieldDefinitionMap {
    return this._fields ||
      (this._fields = defineFieldMap(this, this._typeConfig.fields));
  }

  getPossibleTypes(): Array<GraphQLObjectType> {
    return this._implementations;
  }

  isPossibleType(type: GraphQLObjectType): boolean {
    var possibleTypeNames = this._possibleTypeNames;
    if (!possibleTypeNames) {
      this._possibleTypeNames = possibleTypeNames =
        this.getPossibleTypes().reduce(
          (map, possibleType) => ((map[possibleType.name] = true), map),
          {}
        );
    }
    return possibleTypeNames[type.name] === true;
  }

  getObjectType(value: any, info: GraphQLResolveInfo): ?GraphQLObjectType {
    var resolver = this.resolveType;
    return resolver ? resolver(value, info) : getTypeOf(value, info, this);
  }

  toString(): string {
    return this.name;
  }
}

function getTypeOf(
  value: any,
  info: GraphQLResolveInfo,
  abstractType: GraphQLAbstractType
): ?GraphQLObjectType {
  var possibleTypes = abstractType.getPossibleTypes();
  for (var i = 0; i < possibleTypes.length; i++) {
    var type = possibleTypes[i];
    if (typeof type.isTypeOf === 'function' && type.isTypeOf(value, info)) {
      return type;
    }
  }
}

export type GraphQLInterfaceTypeConfig = {
  name: string,
  fields: GraphQLFieldConfigMapThunk | GraphQLFieldConfigMap,
  /**
   * Optionally provide a custom type resolver function. If one is not provided,
   * the default implemenation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: (value: any, info?: GraphQLResolveInfo) => ?GraphQLObjectType,
  description?: ?string
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
 *     var PetType = new GraphQLUnionType({
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
  resolveType: ?(value: any, info?: GraphQLResolveInfo) => ?GraphQLObjectType;

  _typeConfig: GraphQLUnionTypeConfig;
  _types: Array<GraphQLObjectType>;
  _possibleTypeNames: {[typeName: string]: boolean};

  constructor(config: GraphQLUnionTypeConfig) {
    invariant(config.name, 'Type must be named.');
    this.name = config.name;
    this.description = config.description;
    this.resolveType = config.resolveType;
    invariant(
      Array.isArray(config.types) && config.types.length > 0,
      `Must provide Array of types for Union ${config.name}.`
    );
    config.types.forEach(type => {
      invariant(
        type instanceof GraphQLObjectType,
        `${this} may only contain Object types, it cannot contain: ${type}.`
      );
      if (typeof this.resolveType !== 'function') {
        invariant(
          typeof type.isTypeOf === 'function',
          `Union Type ${this} does not provide a "resolveType" function ` +
          `and possible Type ${type} does not provide a "isTypeOf" ` +
          `function. There is no way to resolve this possible type ` +
          `during execution.`
        );
      }
    });
    this._types = config.types;
    this._typeConfig = config;
  }

  getPossibleTypes(): Array<GraphQLObjectType> {
    return this._types;
  }

  isPossibleType(type: GraphQLObjectType): boolean {
    var possibleTypeNames = this._possibleTypeNames;
    if (!possibleTypeNames) {
      this._possibleTypeNames = possibleTypeNames =
        this.getPossibleTypes().reduce(
          (map, possibleType) => ((map[possibleType.name] = true), map),
          {}
        );
    }
    return possibleTypeNames[type.name] === true;
  }

  getObjectType(value: any, info: GraphQLResolveInfo): ?GraphQLObjectType {
    var resolver = this._typeConfig.resolveType;
    return resolver ? resolver(value, info) : getTypeOf(value, info, this);
  }

  toString(): string {
    return this.name;
  }
}

export type GraphQLUnionTypeConfig = {
  name: string,
  types: Array<GraphQLObjectType>,
  /**
   * Optionally provide a custom type resolver function. If one is not provided,
   * the default implemenation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: (value: any, info?: GraphQLResolveInfo) => ?GraphQLObjectType;
  description?: ?string;
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
 *     var RGBType = new GraphQLEnumType({
 *       name: 'RGB',
 *       values: {
 *         RED: { value: 0 },
 *         GREEN: { value: 1 },
 *         BLUE: { value: 2 }
 *       }
 *     });
 *
 * Note: If a value is not provided in a definition, the name of the enum value
 * will be used as it's internal value.
 */
export class GraphQLEnumType/* <T> */ {
  name: string;
  description: ?string;

  _enumConfig: GraphQLEnumTypeConfig/* <T> */;
  _values: GraphQLEnumValueDefinitionMap/* <T> */;
  _valueLookup: Map<any/* T */, GraphQLEnumValueDefinition>;
  _nameLookup: Map<string, GraphQLEnumValueDefinition>;

  constructor(config: GraphQLEnumTypeConfig/* <T> */) {
    this.name = config.name;
    this.description = config.description;
    this._enumConfig = config;
  }

  getValues(): GraphQLEnumValueDefinitionMap/* <T> */ {
    return this._values || (this._values = this._defineValueMap());
  }

  serialize(value: any/* T */): ?string {
    var enumValue = this._getValueLookup().get((value: any));
    return enumValue ? enumValue.name : null;
  }

  parseValue(value: any): ?any/* T */ {
    var enumValue = this._getNameLookup().get(value);
    if (enumValue) {
      return enumValue.value;
    }
  }

  parseLiteral(valueAST: Value): ?any/* T */ {
    if (valueAST.kind === ENUM) {
      var enumValue = this._getNameLookup().get(valueAST.value);
      if (enumValue) {
        return enumValue.value;
      }
    }
  }

  _defineValueMap(): GraphQLEnumValueDefinitionMap/* <T> */ {
    var valueMap = (this._enumConfig.values: any);
    Object.keys(valueMap).forEach(valueName => {
      var value = valueMap[valueName];
      value.name = valueName;
      if (!value.hasOwnProperty('value')) {
        value.value = valueName;
      }
    });
    return valueMap;
  }

  _getValueLookup(): Map<any/* T */, GraphQLEnumValueDefinition> {
    if (!this._valueLookup) {
      var lookup = new Map();
      var values = this.getValues();
      Object.keys(values).forEach(valueName => {
        var value = values[valueName];
        lookup.set(value.value, value);
      });
      this._valueLookup = lookup;
    }
    return this._valueLookup;
  }

  _getNameLookup(): Map<string, GraphQLEnumValueDefinition> {
    if (!this._nameLookup) {
      var lookup = new Map();
      var values = this.getValues();
      Object.keys(values).forEach(valueName => {
        var value = values[valueName];
        lookup.set(value.name, value);
      });
      this._nameLookup = lookup;
    }
    return this._nameLookup;
  }

  toString(): string {
    return this.name;
  }
}

export type GraphQLEnumTypeConfig/* <T> */ = {
  name: string;
  values: GraphQLEnumValueConfigMap/* <T> */;
  description?: ?string;
}

export type GraphQLEnumValueConfigMap/* <T> */ = {
  [valueName: string]: GraphQLEnumValueConfig/* <T> */;
};

export type GraphQLEnumValueConfig/* <T> */ = {
  value?: any/* T */;
  deprecationReason?: string;
  description?: ?string;
}

export type GraphQLEnumValueDefinitionMap/* <T> */ = {
  [valueName: string]: GraphQLEnumValueDefinition/* <T> */;
};

export type GraphQLEnumValueDefinition/* <T> */ = {
  name: string;
  value?: any/* T */;
  deprecationReason?: string;
  description?: ?string;
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
 *     var GeoPoint = new GraphQLInputObjectType({
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

  _typeConfig: InputObjectConfig;
  _fields: InputObjectFieldMap;

  constructor(config: InputObjectConfig) {
    invariant(config.name, 'Type must be named.');
    this.name = config.name;
    this.description = config.description;
    this._typeConfig = config;
  }

  getFields(): InputObjectFieldMap {
    return this._fields || (this._fields = this._defineFieldMap());
  }

  _defineFieldMap(): InputObjectFieldMap {
    var fieldMap: any = resolveMaybeThunk(this._typeConfig.fields);
    invariant(
      typeof fieldMap === 'object' && !Array.isArray(fieldMap),
      `${this} fields must be an object with field names as keys or a ` +
      `function which returns such an object.`
    );
    var fieldNames = Object.keys(fieldMap);
    invariant(
      fieldNames.length > 0,
      `${this} fields must be an object with field names as keys or a ` +
      `function which returns such an object.`
    );
    fieldNames.forEach(fieldName => {
      var field = fieldMap[fieldName];
      field.name = fieldName;
      invariant(
        isInputType(field.type),
        `${this}.${fieldName} field type must be Input Type but ` +
        `got: ${field.type}.`
      );
    });
    return fieldMap;
  }

  toString(): string {
    return this.name;
  }
}

export type InputObjectConfig = {
  name: string;
  fields: InputObjectConfigFieldMapThunk | InputObjectConfigFieldMap;
  description?: ?string;
}

type InputObjectConfigFieldMapThunk = () => InputObjectConfigFieldMap;

export type InputObjectFieldConfig = {
  type: GraphQLInputType;
  defaultValue?: any;
  description?: ?string;
}

export type InputObjectConfigFieldMap = {
  [fieldName: string]: InputObjectFieldConfig;
};

export type InputObjectField = {
  name: string;
  type: GraphQLInputType;
  defaultValue?: any;
  description?: ?string;
}

export type InputObjectFieldMap = {
  [fieldName: string]: InputObjectField;
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
 *     var PersonType = new GraphQLObjectType({
 *       name: 'Person',
 *       fields: () => ({
 *         parents: { type: new GraphQLList(Person) },
 *         children: { type: new GraphQLList(Person) },
 *       })
 *     })
 *
 */
export class GraphQLList {
  ofType: GraphQLType;

  constructor(type: GraphQLType) {
    this.ofType = type;
  }

  toString(): string {
    return '[' + String(this.ofType) + ']';
  }
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
 *     var RowType = new GraphQLObjectType({
 *       name: 'Row',
 *       fields: () => ({
 *         id: { type: new GraphQLNonNull(String) },
 *       })
 *     })
 *
 * Note: the enforcement of non-nullability occurs within the executor.
 */
export class GraphQLNonNull {
  ofType: GraphQLType;

  constructor(type: GraphQLType) {
    invariant(
      !(type instanceof GraphQLNonNull),
      'Cannot nest NonNull inside NonNull.'
    );
    this.ofType = type;
  }

  toString(): string {
    return this.ofType.toString() + '!';
  }
}
