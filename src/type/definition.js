/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import invariant from '../utils/invariant';
import { ENUM } from '../language/kinds';
import type { Value } from '../language/ast';
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
 * Scalars (or Enums) and are defined with a name and a series of coercion
 * functions used to ensure validity.
 *
 * Example:
 *
 *     var OddType = new GraphQLScalarType({
 *       name: 'Odd',
 *       coerce(value) {
 *         return value % 2 === 1 ? value : null;
 *       }
 *     });
 *
 */
export class GraphQLScalarType/*<T>*/ {
  name: string;
  description: ?string;

  _scalarConfig: GraphQLScalarTypeConfig/*<T>*/;

  constructor(config: GraphQLScalarTypeConfig/*<T>*/) {
    invariant(config.name, 'Type must be named.');
    this.name = config.name;
    this.description = config.description;
    this._scalarConfig = config;
  }

  coerce(value: any): ?any/*T*/ {
    var coercer = this._scalarConfig.coerce;
    return coercer(value);
  }

  coerceLiteral(value: Value): ?any/*T*/ {
    var coercer = this._scalarConfig.coerceLiteral;
    return coercer ? coercer(value) : null;
  }

  toString(): string {
    return this.name;
  }
}

type GraphQLScalarTypeConfig/*<T>*/ = {
  name: string;
  description?: string;
  coerce: (value: any) => ?any/*T*/;
  coerceLiteral: (value: Value) => ?any/*T*/;
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

  _typeConfig: GraphQLObjectTypeConfig;
  _fields: GraphQLFieldDefinitionMap;
  _interfaces: Array<GraphQLInterfaceType>;

  constructor(config: GraphQLObjectTypeConfig) {
    invariant(config.name, 'Type must be named.');
    this.name = config.name;
    this.description = config.description;
    this._typeConfig = config;
    addImplementationToInterfaces(this);
  }

  getFields(): GraphQLFieldDefinitionMap {
    return this._fields ||
      (this._fields = defineFieldMap(this._typeConfig.fields));
  }

  getInterfaces(): Array<GraphQLInterfaceType> {
    return this._interfaces ||
      (this._interfaces = defineInterfaces(this._typeConfig.interfaces || []));
  }

  isTypeOf(value: any): ?boolean {
    var predicate = this._typeConfig.isTypeOf;
    if (predicate) {
      return predicate(value);
    }
  }

  toString(): string {
    return this.name;
  }
}

function resolveMaybeThunk<T>(thingOrThunk: T | () => T): T {
  return typeof thingOrThunk === 'function' ? thingOrThunk() : thingOrThunk;
}

function defineInterfaces(interfacesOrThunk): Array<GraphQLInterfaceType> {
  return resolveMaybeThunk(interfacesOrThunk);
}

function defineFieldMap(
  fields: GraphQLFieldConfigMap
): GraphQLFieldDefinitionMap {
  var fieldMap: any = resolveMaybeThunk(fields);
  Object.keys(fieldMap).forEach(fieldName => {
    var field = fieldMap[fieldName];
    field.name = fieldName;
    if (!field.args) {
      field.args = [];
    } else {
      field.args = Object.keys(field.args).map(argName => {
        var arg = field.args[argName];
        invariant(
          arg.type,
          'Arg must supply type. ' + fieldName + '.' + argName
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

type GraphQLObjectTypeConfig = {
  name: string;
  interfaces?: GraphQLInterfacesThunk | Array<GraphQLInterfaceType>;
  fields: GraphQLFieldConfigMapThunk | GraphQLFieldConfigMap;
  isTypeOf?: (value: any) => boolean;
  description?: string
}

type GraphQLInterfacesThunk = () => Array<GraphQLInterfaceType>;

type GraphQLFieldConfigMapThunk = () => GraphQLFieldConfigMap;

type GraphQLFieldConfig = {
  type: GraphQLOutputType;
  args?: GraphQLFieldConfigArgumentMap;
    resolve?: (
    source?: any,
    args?: ?{[argName: string]: any},
    context?: any,
    fieldAST?: any,
    fieldType?: any,
    parentType?: any,
    schema?: GraphQLSchema
  ) => any;
  deprecationReason?: string;
  description?: string;
}

type GraphQLFieldConfigArgumentMap = {
  [argName: string]: GraphQLArgumentConfig;
};

type GraphQLArgumentConfig = {
  type: GraphQLInputType;
  defaultValue?: any;
}

type GraphQLFieldConfigMap = {
  [fieldName: string]: GraphQLFieldConfig;
};

export type GraphQLFieldDefinition = {
  name: string;
  description: ?string;
  type: GraphQLOutputType;
  args: Array<GraphQLArgument>;
  resolve?: (
    source?: any,
    args?: ?{[argName: string]: any},
    context?: any,
    fieldAST?: any,
    fieldType?: any,
    parentType?: any,
    schema?: GraphQLSchema
  ) => any;
  deprecationReason?: ?string;
}

export type GraphQLArgument = {
  name: string;
  type: GraphQLInputType;
  defaultValue?: any;
  description?: string;
};

type GraphQLFieldDefinitionMap = {
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

  _typeConfig: GraphQLInterfaceTypeConfig;
  _fields: GraphQLFieldDefinitionMap;
  _implementations: Array<GraphQLObjectType>;
  _possibleTypeNames: {[typeName: string]: boolean};

  constructor(config: GraphQLInterfaceTypeConfig) {
    invariant(config.name, 'Type must be named.');
    this.name = config.name;
    this.description = config.description;
    this._typeConfig = config;
    this._implementations = [];
  }

  getFields(): GraphQLFieldDefinitionMap {
    return this._fields ||
      (this._fields = defineFieldMap(this._typeConfig.fields));
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

  resolveType(value: any): ?GraphQLObjectType {
    var resolver = this._typeConfig.resolveType;
    return resolver ? resolver(value) : getTypeOf(value, this);
  }

  toString(): string {
    return this.name;
  }
}

function getTypeOf(
  value: any,
  abstractType: GraphQLAbstractType
): ?GraphQLObjectType {
  var possibleTypes = abstractType.getPossibleTypes();
  for (var i = 0; i < possibleTypes.length; i++) {
    var type = possibleTypes[i];
    var isTypeOf = type.isTypeOf(value);
    if (isTypeOf === undefined) {
      // TODO: move this to a JS impl specific type system validation step
      // so the error can be found before execution.
      throw new Error(
        'Non-Object Type ' + abstractType.name + ' does not implement ' +
        'resolveType and Object Type ' + type.name + ' does not implement ' +
        'isTypeOf. There is no way to determine if a value is of this type.'
      );
    }
    if (isTypeOf) {
      return type;
    }
  }
}

type GraphQLInterfaceTypeConfig = {
  name: string,
  fields: GraphQLFieldConfigMapThunk | GraphQLFieldConfigMap,
  /**
   * Optionally provide a custom type resolver function. If one is not provided,
   * the default implemenation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: (value: any) => ?GraphQLObjectType,
  description?: string
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

  _typeConfig: GraphQLUnionTypeConfig;
  _types: Array<GraphQLObjectType>;
  _possibleTypeNames: {[typeName: string]: boolean};

  constructor(config: GraphQLUnionTypeConfig) {
    invariant(config.name, 'Type must be named.');
    this.name = config.name;
    this.description = config.description;
    invariant(
      config.types && config.types.length,
      `Must provide types for Union ${config.name}.`
    );
    if (!config.types.every(x => x instanceof GraphQLObjectType)) {
      var nonObjectTypes = config.types.filter(
        x => !(x instanceof GraphQLObjectType)
      );
      throw new Error(
        `Union ${config.name} may only contain object types, it cannot ` +
        `contain: ${nonObjectTypes.join(', ')}.`
      );
    }
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

  resolveType(value: any): ?GraphQLObjectType {
    var resolver = this._typeConfig.resolveType;
    return resolver ? resolver(value) : getTypeOf(value, this);
  }

  toString(): string {
    return this.name;
  }
}

type GraphQLUnionTypeConfig = {
  name: string,
  types: Array<GraphQLObjectType>,
  /**
   * Optionally provide a custom type resolver function. If one is not provided,
   * the default implemenation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: (value: any) => ?GraphQLObjectType;
  description?: string;
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
export class GraphQLEnumType/*<T>*/ {
  name: string;
  description: ?string;

  _enumConfig: GraphQLEnumTypeConfig/*<T>*/;
  _values: GraphQLEnumValueDefinitionMap/*<T>*/;
  _valueLookup: Map<any/*T*/, GraphQLEnumValueDefinition>;
  _nameLookup: Map<string, GraphQLEnumValueDefinition>;

  constructor(config: GraphQLEnumTypeConfig/*<T>*/) {
    this.name = config.name;
    this.description = config.description;
    this._enumConfig = config;
  }

  getValues(): GraphQLEnumValueDefinitionMap/*<T>*/ {
    return this._values || (this._values = this._defineValueMap());
  }

  coerce(value: any/*T*/): ?string {
    var enumValue = this._getValueLookup().get((value: any));
    return enumValue ? enumValue.name : null;
  }

  coerceLiteral(value: Value): ?any/*T*/ {
    if (value.kind === ENUM) {
      var enumValue = this._getNameLookup().get(value.value);
      if (enumValue) {
        return enumValue.value;
      }
    }
  }

  _defineValueMap(): GraphQLEnumValueDefinitionMap/*<T>*/ {
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

  _getValueLookup(): Map<any/*T*/, GraphQLEnumValueDefinition> {
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

type GraphQLEnumTypeConfig/*<T>*/ = {
  name: string;
  values: GraphQLEnumValueConfigMap/*<T>*/;
  description?: string;
}

type GraphQLEnumValueConfigMap/*<T>*/ = {
  [valueName: string]: GraphQLEnumValueConfig/*<T>*/;
};

type GraphQLEnumValueConfig/*<T>*/ = {
  value?: any/*T*/;
  deprecationReason?: string;
  description?: string;
}

type GraphQLEnumValueDefinitionMap/*<T>*/ = {
  [valueName: string]: GraphQLEnumValueDefinition/*<T>*/;
};

type GraphQLEnumValueDefinition/*<T>*/ = {
  name: string;
  value?: any/*T*/;
  deprecationReason?: string;
  description?: string;
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
    var fields = this._typeConfig.fields;
    var fieldMap: any = typeof fields === 'function' ? fields() : fields;
    Object.keys(fieldMap).forEach(fieldName => {
      var field = fieldMap[fieldName];
      field.name = fieldName;
    });
    return fieldMap;
  }

  toString(): string {
    return this.name;
  }
}

type InputObjectConfig = {
  name: string;
  fields: InputObjectConfigFieldMapThunk | InputObjectConfigFieldMap;
  description?: string;
}

type InputObjectConfigFieldMapThunk = () => InputObjectConfigFieldMap;

type InputObjectFieldConfig = {
  type: GraphQLInputType;
  defaultValue?: any;
  description?: string;
}

type InputObjectConfigFieldMap = {
  [fieldName: string]: InputObjectFieldConfig;
};

export type InputObjectField = {
  name: string;
  type: GraphQLInputType;
  defaultValue?: any;
  description?: string;
}

type InputObjectFieldMap = {
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
    return '[' + this.ofType.toString() + ']';
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
