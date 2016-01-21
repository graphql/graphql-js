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
import keyMap from '../jsutils/keyMap';
import { ENUM } from '../language/kinds';
import type {
  OperationDefinition,
  Field,
  FragmentDefinition,
  Value,
} from '../language/ast';
import type { GraphQLSchema } from './schema';


// Predicates

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

export function isInputType(type: ?GraphQLType): boolean {
  const namedType = getNamedType(type);
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
  GraphQLList<GraphQLOutputType> |
  GraphQLNonNull<
    GraphQLScalarType |
    GraphQLObjectType |
    GraphQLInterfaceType |
    GraphQLUnionType |
    GraphQLEnumType |
    GraphQLList<GraphQLOutputType>
  >;

export function isOutputType(type: ?GraphQLType): boolean {
  const namedType = getNamedType(type);
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
  const namedType = getNamedType(type);
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
  let unmodifiedType = type;
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
 *     const OddType = new GraphQLScalarType({
 *       name: 'Odd',
 *       serialize(value) {
 *         return value % 2 === 1 ? value : null;
 *       }
 *     });
 *
 */
export class GraphQLScalarType<InternalType> {
  name: string;
  description: ?string;

  _scalarConfig: GraphQLScalarTypeConfig<InternalType>;

  constructor(config: GraphQLScalarTypeConfig<InternalType>) {
    invariant(config.name, 'Type must be named.');
    assertValidName(config.name);
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

  serialize(value: mixed): ?InternalType {
    const serializer = this._scalarConfig.serialize;
    return serializer(value);
  }

  parseValue(value: mixed): ?InternalType {
    const parser = this._scalarConfig.parseValue;
    return parser ? parser(value) : null;
  }

  parseLiteral(valueAST: Value): ?InternalType {
    const parser = this._scalarConfig.parseLiteral;
    return parser ? parser(valueAST) : null;
  }

  toString(): string {
    return this.name;
  }
}

export type GraphQLScalarTypeConfig<InternalType> = {
  name: string;
  description?: ?string;
  serialize: (value: mixed) => ?InternalType;
  parseValue?: (value: mixed) => ?InternalType;
  parseLiteral?: (valueAST: Value) => ?InternalType;
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
export class GraphQLObjectType {
  name: string;
  description: ?string;
  isTypeOf: ?(value: mixed, info?: GraphQLResolveInfo) => boolean;

  _typeConfig: GraphQLObjectTypeConfig;
  _fields: GraphQLFieldDefinitionMap;
  _interfaces: Array<GraphQLInterfaceType>;

  constructor(config: GraphQLObjectTypeConfig) {
    invariant(config.name, 'Type must be named.');
    assertValidName(config.name);
    this.name = config.name;
    this.description = config.description;
    if (config.isTypeOf) {
      invariant(
        typeof config.isTypeOf === 'function',
        `${this} must provide "isTypeOf" as a function.`
      );
    }
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
  const interfaces = resolveMaybeThunk(interfacesOrThunk);
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
  const fieldMap: any = resolveMaybeThunk(fields);
  invariant(
    isPlainObj(fieldMap),
    `${type} fields must be an object with field names as keys or a ` +
    `function which returns such an object.`
  );

  const fieldNames = Object.keys(fieldMap);
  invariant(
    fieldNames.length > 0,
    `${type} fields must be an object with field names as keys or a ` +
    `function which returns such an object.`
  );

  const resultFieldMap = {};
  fieldNames.forEach(fieldName => {
    assertValidName(fieldName);
    const field = {
      ...fieldMap[fieldName],
      name: fieldName
    };
    invariant(
      !field.hasOwnProperty('isDeprecated'),
      `${type}.${fieldName} should provide "deprecationReason" instead ` +
      `of "isDeprecated".`
    );
    invariant(
      isOutputType(field.type),
      `${type}.${fieldName} field type must be Output Type but ` +
      `got: ${field.type}.`
    );
    if (!field.args) {
      field.args = [];
    } else {
      invariant(
        isPlainObj(field.args),
        `${type}.${fieldName} args must be an object with argument names ` +
        `as keys.`
      );
      field.args = Object.keys(field.args).map(argName => {
        assertValidName(argName);
        const arg = field.args[argName];
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
    resultFieldMap[fieldName] = field;
  });
  return resultFieldMap;
}

function isPlainObj(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj);
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
  isTypeOf?: (value: mixed, info?: GraphQLResolveInfo) => boolean;
  description?: ?string
}

type GraphQLInterfacesThunk = () => Array<GraphQLInterfaceType>;

type GraphQLFieldConfigMapThunk = () => GraphQLFieldConfigMap;

export type GraphQLFieldResolveFn = (
  source: mixed,
  args: {[argName: string]: mixed},
  info: GraphQLResolveInfo
) => mixed

export type GraphQLResolveInfo = {
  fieldName: string,
  fieldASTs: Array<Field>,
  returnType: GraphQLOutputType,
  parentType: GraphQLCompositeType,
  schema: GraphQLSchema,
  fragments: { [fragmentName: string]: FragmentDefinition },
  rootValue: mixed,
  operation: OperationDefinition,
  variableValues: { [variableName: string]: mixed },
}

export type GraphQLFieldConfig = {
  type: GraphQLOutputType;
  args?: GraphQLFieldConfigArgumentMap;
  resolve?: GraphQLFieldResolveFn;
  deprecationReason?: ?string;
  description?: ?string;
}

export type GraphQLFieldConfigArgumentMap = {
  [argName: string]: GraphQLArgumentConfig;
};

export type GraphQLArgumentConfig = {
  type: GraphQLInputType;
  defaultValue?: mixed;
  description?: ?string;
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
  defaultValue?: mixed;
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
  resolveType: ?(value: mixed, info?: GraphQLResolveInfo) => ?GraphQLObjectType;

  _typeConfig: GraphQLInterfaceTypeConfig;
  _fields: GraphQLFieldDefinitionMap;
  _implementations: Array<GraphQLObjectType>;
  _possibleTypes: { [typeName: string]: GraphQLObjectType };

  constructor(config: GraphQLInterfaceTypeConfig) {
    invariant(config.name, 'Type must be named.');
    assertValidName(config.name);
    this.name = config.name;
    this.description = config.description;
    if (config.resolveType) {
      invariant(
        typeof config.resolveType === 'function',
        `${this} must provide "resolveType" as a function.`
      );
    }
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
    const possibleTypes = this._possibleTypes || (this._possibleTypes =
      keyMap(this.getPossibleTypes(), possibleType => possibleType.name)
    );
    return Boolean(possibleTypes[type.name]);
  }

  getObjectType(value: mixed, info: GraphQLResolveInfo): ?GraphQLObjectType {
    const resolver = this.resolveType;
    return resolver ? resolver(value, info) : getTypeOf(value, info, this);
  }

  toString(): string {
    return this.name;
  }
}

function getTypeOf(
  value: mixed,
  info: GraphQLResolveInfo,
  abstractType: GraphQLAbstractType
): ?GraphQLObjectType {
  const possibleTypes = abstractType.getPossibleTypes();
  for (let i = 0; i < possibleTypes.length; i++) {
    const type = possibleTypes[i];
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
   * the default implementation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: (value: mixed, info?: GraphQLResolveInfo) => ?GraphQLObjectType,
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
  resolveType: ?(value: mixed, info?: GraphQLResolveInfo) => ?GraphQLObjectType;

  _typeConfig: GraphQLUnionTypeConfig;
  _types: Array<GraphQLObjectType>;
  _possibleTypeNames: {[typeName: string]: boolean};

  constructor(config: GraphQLUnionTypeConfig) {
    invariant(config.name, 'Type must be named.');
    assertValidName(config.name);
    this.name = config.name;
    this.description = config.description;
    if (config.resolveType) {
      invariant(
        typeof config.resolveType === 'function',
        `${this} must provide "resolveType" as a function.`
      );
    }
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
    let possibleTypeNames = this._possibleTypeNames;
    if (!possibleTypeNames) {
      this._possibleTypeNames = possibleTypeNames =
        this.getPossibleTypes().reduce(
          (map, possibleType) => ((map[possibleType.name] = true), map),
          {}
        );
    }
    return possibleTypeNames[type.name] === true;
  }

  getObjectType(value: mixed, info: GraphQLResolveInfo): ?GraphQLObjectType {
    const resolver = this._typeConfig.resolveType;
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
   * the default implementation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: (value: mixed, info?: GraphQLResolveInfo) => ?GraphQLObjectType;
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

  _enumConfig: GraphQLEnumTypeConfig/* <T> */;
  _values: Array<GraphQLEnumValueDefinition/* <T> */>;
  _valueLookup: Map<any/* T */, GraphQLEnumValueDefinition>;
  _nameLookup: { [valueName: string]: GraphQLEnumValueDefinition };

  constructor(config: GraphQLEnumTypeConfig/* <T> */) {
    this.name = config.name;
    assertValidName(config.name);
    this.description = config.description;
    this._values = defineEnumValues(this, config.values);
    this._enumConfig = config;
  }

  getValues(): Array<GraphQLEnumValueDefinition/* <T> */> {
    return this._values;
  }

  serialize(value: any/* T */): ?string {
    const enumValue = this._getValueLookup().get(value);
    return enumValue ? enumValue.name : null;
  }

  parseValue(value: mixed): ?any/* T */ {
    if (typeof value === 'string') {
      const enumValue = this._getNameLookup()[value];
      if (enumValue) {
        return enumValue.value;
      }
    }
  }

  parseLiteral(valueAST: Value): ?any/* T */ {
    if (valueAST.kind === ENUM) {
      const enumValue = this._getNameLookup()[valueAST.value];
      if (enumValue) {
        return enumValue.value;
      }
    }
  }

  _getValueLookup(): Map<any/* T */, GraphQLEnumValueDefinition> {
    if (!this._valueLookup) {
      const lookup = new Map();
      this.getValues().forEach(value => {
        lookup.set(value.value, value);
      });
      this._valueLookup = lookup;
    }
    return this._valueLookup;
  }

  _getNameLookup(): { [valueName: string]: GraphQLEnumValueDefinition } {
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
}

function defineEnumValues(
  type: GraphQLEnumType,
  valueMap: GraphQLEnumValueConfigMap/* <T> */
): Array<GraphQLEnumValueDefinition/* <T> */> {
  invariant(
    isPlainObj(valueMap),
    `${type} values must be an object with value names as keys.`
  );
  const valueNames = Object.keys(valueMap);
  invariant(
    valueNames.length > 0,
    `${type} values must be an object with value names as keys.`
  );
  return valueNames.map(valueName => {
    assertValidName(valueName);
    const value = valueMap[valueName];
    invariant(
      isPlainObj(value),
      `${type}.${valueName} must refer to an object with a "value" key ` +
      `representing an internal value but got: ${value}.`
    );
    invariant(
      !value.hasOwnProperty('isDeprecated'),
      `${type}.${valueName} should provide "deprecationReason" instead ` +
      `of "isDeprecated".`
    );
    return {
      name: valueName,
      description: value.description,
      deprecationReason: value.deprecationReason,
      value: isNullish(value.value) ? valueName : value.value,
    };
  });
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
  deprecationReason?: ?string;
  description?: ?string;
}

export type GraphQLEnumValueDefinition/* <T> */ = {
  name: string;
  description: ?string;
  deprecationReason: ?string;
  value: any/* T */;
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
  description: ?string;

  _typeConfig: InputObjectConfig;
  _fields: InputObjectFieldMap;

  constructor(config: InputObjectConfig) {
    invariant(config.name, 'Type must be named.');
    assertValidName(config.name);
    this.name = config.name;
    this.description = config.description;
    this._typeConfig = config;
  }

  getFields(): InputObjectFieldMap {
    return this._fields || (this._fields = this._defineFieldMap());
  }

  _defineFieldMap(): InputObjectFieldMap {
    const fieldMap: any = resolveMaybeThunk(this._typeConfig.fields);
    invariant(
      isPlainObj(fieldMap),
      `${this} fields must be an object with field names as keys or a ` +
      `function which returns such an object.`
    );
    const fieldNames = Object.keys(fieldMap);
    invariant(
      fieldNames.length > 0,
      `${this} fields must be an object with field names as keys or a ` +
      `function which returns such an object.`
    );
    const resultFieldMap = {};
    fieldNames.forEach(fieldName => {
      assertValidName(fieldName);
      const field = {
        ...fieldMap[fieldName],
        name: fieldName
      };
      invariant(
        isInputType(field.type),
        `${this}.${fieldName} field type must be Input Type but ` +
        `got: ${field.type}.`
      );
      resultFieldMap[fieldName] = field;
    });
    return resultFieldMap;
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
  defaultValue?: mixed;
  description?: ?string;
}

export type InputObjectConfigFieldMap = {
  [fieldName: string]: InputObjectFieldConfig;
};

export type InputObjectField = {
  name: string;
  type: GraphQLInputType;
  defaultValue?: mixed;
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

  constructor(type: T) {
    invariant(
      isType(type),
      `Can only create List of a GraphQLType but got: ${type}.`
    );
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

  constructor(type: T) {
    invariant(
      isType(type) && !(type instanceof GraphQLNonNull),
      `Can only create NonNull of a Nullable GraphQLType but got: ${type}.`
    );
    this.ofType = type;
  }

  toString(): string {
    return this.ofType.toString() + '!';
  }
}

const NAME_RX = /^[_a-zA-Z][_a-zA-Z0-9]*$/;

// Helper to assert that provided names are valid.
function assertValidName(name: string): void {
  invariant(
    NAME_RX.test(name),
    `Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "${name}" does not.`
  );
}
