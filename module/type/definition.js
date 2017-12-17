var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

import instanceOf from '../jsutils/instanceOf';
import invariant from '../jsutils/invariant';
import isInvalid from '../jsutils/isInvalid';

import * as Kind from '../language/kinds';
import { valueFromASTUntyped } from '../utilities/valueFromASTUntyped';

import { GraphQLList, GraphQLNonNull } from './wrappers';

// Predicates & Assertions

/**
 * These are all of the possible kinds of types.
 */


export function isType(type) {
  return isScalarType(type) || isObjectType(type) || isInterfaceType(type) || isUnionType(type) || isEnumType(type) || isInputObjectType(type) || isListType(type) || isNonNullType(type);
}

export function assertType(type) {
  !isType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL type.') : void 0;
  return type;
}

/**
 * There are predicates for each kind of GraphQL type.
 */

// eslint-disable-next-line no-redeclare
export function isScalarType(type) {
  return instanceOf(type, GraphQLScalarType);
}

export function assertScalarType(type) {
  !isScalarType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL Scalar type.') : void 0;
  return type;
}

// eslint-disable-next-line no-redeclare
export function isObjectType(type) {
  return instanceOf(type, GraphQLObjectType);
}

export function assertObjectType(type) {
  !isObjectType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL Object type.') : void 0;
  return type;
}

// eslint-disable-next-line no-redeclare
export function isInterfaceType(type) {
  return instanceOf(type, GraphQLInterfaceType);
}

export function assertInterfaceType(type) {
  !isInterfaceType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL Interface type.') : void 0;
  return type;
}

// eslint-disable-next-line no-redeclare
export function isUnionType(type) {
  return instanceOf(type, GraphQLUnionType);
}

export function assertUnionType(type) {
  !isUnionType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL Union type.') : void 0;
  return type;
}

// eslint-disable-next-line no-redeclare
export function isEnumType(type) {
  return instanceOf(type, GraphQLEnumType);
}

export function assertEnumType(type) {
  !isEnumType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL Enum type.') : void 0;
  return type;
}

// eslint-disable-next-line no-redeclare
export function isInputObjectType(type) {
  return instanceOf(type, GraphQLInputObjectType);
}

export function assertInputObjectType(type) {
  !isInputObjectType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL Input Object type.') : void 0;
  return type;
}

// eslint-disable-next-line no-redeclare
export function isListType(type) {
  return instanceOf(type, GraphQLList);
}

export function assertListType(type) {
  !isListType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL List type.') : void 0;
  return type;
}

// eslint-disable-next-line no-redeclare
export function isNonNullType(type) {
  return instanceOf(type, GraphQLNonNull);
}

export function assertNonNullType(type) {
  !isNonNullType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL Non-Null type.') : void 0;
  return type;
}

/**
 * These types may be used as input types for arguments and directives.
 */


export function isInputType(type) {
  return isScalarType(type) || isEnumType(type) || isInputObjectType(type) || isWrappingType(type) && isInputType(type.ofType);
}

export function assertInputType(type) {
  !isInputType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL input type.') : void 0;
  return type;
}

/**
 * These types may be used as output types as the result of fields.
 */


export function isOutputType(type) {
  return isScalarType(type) || isObjectType(type) || isInterfaceType(type) || isUnionType(type) || isEnumType(type) || isWrappingType(type) && isOutputType(type.ofType);
}

export function assertOutputType(type) {
  !isOutputType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL output type.') : void 0;
  return type;
}

/**
 * These types may describe types which may be leaf values.
 */


export function isLeafType(type) {
  return isScalarType(type) || isEnumType(type);
}

export function assertLeafType(type) {
  !isLeafType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL leaf type.') : void 0;
  return type;
}

/**
 * These types may describe the parent context of a selection set.
 */


export function isCompositeType(type) {
  return isObjectType(type) || isInterfaceType(type) || isUnionType(type);
}

export function assertCompositeType(type) {
  !isCompositeType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL composite type.') : void 0;
  return type;
}

/**
 * These types may describe the parent context of a selection set.
 */


export function isAbstractType(type) {
  return isInterfaceType(type) || isUnionType(type);
}

export function assertAbstractType(type) {
  !isAbstractType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL abstract type.') : void 0;
  return type;
}

/**
 * These types wrap and modify other types
 */

export function isWrappingType(type) {
  return isListType(type) || isNonNullType(type);
}

export function assertWrappingType(type) {
  !isWrappingType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL wrapping type.') : void 0;
  return type;
}

/**
 * These types can all accept null as a value.
 */


export function isNullableType(type) {
  return isType(type) && !isNonNullType(type);
}

export function assertNullableType(type) {
  !isNullableType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL nullable type.') : void 0;
  return type;
}

/* eslint-disable no-redeclare */

export function getNullableType(type) {
  /* eslint-enable no-redeclare */
  if (type) {
    return isNonNullType(type) ? type.ofType : type;
  }
}

/**
 * These named types do not include modifiers like List or NonNull.
 */


export function isNamedType(type) {
  return isScalarType(type) || isObjectType(type) || isInterfaceType(type) || isUnionType(type) || isEnumType(type) || isInputObjectType(type);
}

export function assertNamedType(type) {
  !isNamedType(type) ? invariant(0, 'Expected ' + String(type) + ' to be a GraphQL named type.') : void 0;
  return type;
}

/* eslint-disable no-redeclare */

export function getNamedType(type) {
  /* eslint-enable no-redeclare */
  if (type) {
    var unwrappedType = type;
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


function resolveThunk(thunk) {
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
export var GraphQLScalarType = function () {
  function GraphQLScalarType(config) {
    _classCallCheck(this, GraphQLScalarType);

    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this._scalarConfig = config;
    !(typeof config.name === 'string') ? invariant(0, 'Must provide name.') : void 0;
    !(typeof config.serialize === 'function') ? invariant(0, this.name + ' must provide "serialize" function. If this custom Scalar ' + 'is also used as an input type, ensure "parseValue" and "parseLiteral" ' + 'functions are also provided.') : void 0;
    if (config.parseValue || config.parseLiteral) {
      !(typeof config.parseValue === 'function' && typeof config.parseLiteral === 'function') ? invariant(0, this.name + ' must provide both "parseValue" and "parseLiteral" ' + 'functions.') : void 0;
    }
  }

  // Serializes an internal value to include in a response.


  GraphQLScalarType.prototype.serialize = function serialize(value) {
    var serializer = this._scalarConfig.serialize;
    return serializer(value);
  };

  // Parses an externally provided value to use as an input.


  GraphQLScalarType.prototype.parseValue = function parseValue(value) {
    var parser = this._scalarConfig.parseValue;
    if (isInvalid(value)) {
      return undefined;
    }
    return parser ? parser(value) : value;
  };

  // Parses an externally provided literal value to use as an input.


  GraphQLScalarType.prototype.parseLiteral = function parseLiteral(valueNode, variables) {
    var parser = this._scalarConfig.parseLiteral;
    return parser ? parser(valueNode, variables) : valueFromASTUntyped(valueNode, variables);
  };

  GraphQLScalarType.prototype.toString = function toString() {
    return this.name;
  };

  return GraphQLScalarType;
}();

// Also provide toJSON and inspect aliases for toString.
GraphQLScalarType.prototype.toJSON = GraphQLScalarType.prototype.inspect = GraphQLScalarType.prototype.toString;

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
export var GraphQLObjectType = function () {
  function GraphQLObjectType(config) {
    _classCallCheck(this, GraphQLObjectType);

    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes;
    this.isTypeOf = config.isTypeOf;
    this._typeConfig = config;
    !(typeof config.name === 'string') ? invariant(0, 'Must provide name.') : void 0;
    if (config.isTypeOf) {
      !(typeof config.isTypeOf === 'function') ? invariant(0, this.name + ' must provide "isTypeOf" as a function.') : void 0;
    }
  }

  GraphQLObjectType.prototype.getFields = function getFields() {
    return this._fields || (this._fields = defineFieldMap(this, this._typeConfig.fields));
  };

  GraphQLObjectType.prototype.getInterfaces = function getInterfaces() {
    return this._interfaces || (this._interfaces = defineInterfaces(this, this._typeConfig.interfaces));
  };

  GraphQLObjectType.prototype.toString = function toString() {
    return this.name;
  };

  return GraphQLObjectType;
}();

// Also provide toJSON and inspect aliases for toString.
GraphQLObjectType.prototype.toJSON = GraphQLObjectType.prototype.inspect = GraphQLObjectType.prototype.toString;

function defineInterfaces(type, interfacesThunk) {
  var interfaces = resolveThunk(interfacesThunk) || [];
  !Array.isArray(interfaces) ? invariant(0, type.name + ' interfaces must be an Array or a function which returns ' + 'an Array.') : void 0;
  return interfaces;
}

function defineFieldMap(type, fieldsThunk) {
  var fieldMap = resolveThunk(fieldsThunk) || {};
  !isPlainObj(fieldMap) ? invariant(0, type.name + ' fields must be an object with field names as keys or a ' + 'function which returns such an object.') : void 0;

  var resultFieldMap = Object.create(null);
  Object.keys(fieldMap).forEach(function (fieldName) {
    var fieldConfig = fieldMap[fieldName];
    !isPlainObj(fieldConfig) ? invariant(0, type.name + '.' + fieldName + ' field config must be an object') : void 0;
    !!fieldConfig.hasOwnProperty('isDeprecated') ? invariant(0, type.name + '.' + fieldName + ' should provide "deprecationReason" instead ' + 'of "isDeprecated".') : void 0;
    var field = _extends({}, fieldConfig, {
      isDeprecated: Boolean(fieldConfig.deprecationReason),
      name: fieldName
    });
    !isValidResolver(field.resolve) ? invariant(0, type.name + '.' + fieldName + ' field resolver must be a function if ' + ('provided, but got: ' + String(field.resolve) + '.')) : void 0;
    var argsConfig = fieldConfig.args;
    if (!argsConfig) {
      field.args = [];
    } else {
      !isPlainObj(argsConfig) ? invariant(0, type.name + '.' + fieldName + ' args must be an object with argument ' + 'names as keys.') : void 0;
      field.args = Object.keys(argsConfig).map(function (argName) {
        var arg = argsConfig[argName];
        return {
          name: argName,
          description: arg.description === undefined ? null : arg.description,
          type: arg.type,
          defaultValue: arg.defaultValue,
          astNode: arg.astNode
        };
      });
    }
    resultFieldMap[fieldName] = field;
  });
  return resultFieldMap;
}

function isPlainObj(obj) {
  return obj && (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object' && !Array.isArray(obj);
}

// If a resolver is defined, it must be a function.
function isValidResolver(resolver) {
  return resolver == null || typeof resolver === 'function';
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
export var GraphQLInterfaceType = function () {
  function GraphQLInterfaceType(config) {
    _classCallCheck(this, GraphQLInterfaceType);

    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes;
    this.resolveType = config.resolveType;
    this._typeConfig = config;
    !(typeof config.name === 'string') ? invariant(0, 'Must provide name.') : void 0;
    if (config.resolveType) {
      !(typeof config.resolveType === 'function') ? invariant(0, this.name + ' must provide "resolveType" as a function.') : void 0;
    }
  }

  GraphQLInterfaceType.prototype.getFields = function getFields() {
    return this._fields || (this._fields = defineFieldMap(this, this._typeConfig.fields));
  };

  GraphQLInterfaceType.prototype.toString = function toString() {
    return this.name;
  };

  return GraphQLInterfaceType;
}();

// Also provide toJSON and inspect aliases for toString.
GraphQLInterfaceType.prototype.toJSON = GraphQLInterfaceType.prototype.inspect = GraphQLInterfaceType.prototype.toString;

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
export var GraphQLUnionType = function () {
  function GraphQLUnionType(config) {
    _classCallCheck(this, GraphQLUnionType);

    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this.resolveType = config.resolveType;
    this._typeConfig = config;
    !(typeof config.name === 'string') ? invariant(0, 'Must provide name.') : void 0;
    if (config.resolveType) {
      !(typeof config.resolveType === 'function') ? invariant(0, this.name + ' must provide "resolveType" as a function.') : void 0;
    }
  }

  GraphQLUnionType.prototype.getTypes = function getTypes() {
    return this._types || (this._types = defineTypes(this, this._typeConfig.types));
  };

  GraphQLUnionType.prototype.toString = function toString() {
    return this.name;
  };

  return GraphQLUnionType;
}();

// Also provide toJSON and inspect aliases for toString.
GraphQLUnionType.prototype.toJSON = GraphQLUnionType.prototype.inspect = GraphQLUnionType.prototype.toString;

function defineTypes(unionType, typesThunk) {
  var types = resolveThunk(typesThunk) || [];
  !Array.isArray(types) ? invariant(0, 'Must provide Array of types or a function which returns ' + ('such an array for Union ' + unionType.name + '.')) : void 0;
  return types;
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
export var GraphQLEnumType /* <T> */ = function () {
  function GraphQLEnumType(config /* <T> */) {
    _classCallCheck(this, GraphQLEnumType);

    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this._enumConfig = config;
    !(typeof config.name === 'string') ? invariant(0, 'Must provide name.') : void 0;
  }

  GraphQLEnumType.prototype.getValues = function getValues() {
    return this._values || (this._values = defineEnumValues(this, this._enumConfig.values));
  };

  GraphQLEnumType.prototype.getValue = function getValue(name) {
    return this._getNameLookup()[name];
  };

  GraphQLEnumType.prototype.serialize = function serialize(value /* T */) {
    var enumValue = this._getValueLookup().get(value);
    if (enumValue) {
      return enumValue.name;
    }
  };

  GraphQLEnumType.prototype.parseValue = function parseValue(value) /* T */{
    if (typeof value === 'string') {
      var enumValue = this._getNameLookup()[value];
      if (enumValue) {
        return enumValue.value;
      }
    }
  };

  GraphQLEnumType.prototype.parseLiteral = function parseLiteral(valueNode, _variables) /* T */{
    // Note: variables will be resolved to a value before calling this function.
    if (valueNode.kind === Kind.ENUM) {
      var enumValue = this._getNameLookup()[valueNode.value];
      if (enumValue) {
        return enumValue.value;
      }
    }
  };

  GraphQLEnumType.prototype._getValueLookup = function _getValueLookup() {
    if (!this._valueLookup) {
      var lookup = new Map();
      this.getValues().forEach(function (value) {
        lookup.set(value.value, value);
      });
      this._valueLookup = lookup;
    }
    return this._valueLookup;
  };

  GraphQLEnumType.prototype._getNameLookup = function _getNameLookup() {
    if (!this._nameLookup) {
      var lookup = Object.create(null);
      this.getValues().forEach(function (value) {
        lookup[value.name] = value;
      });
      this._nameLookup = lookup;
    }
    return this._nameLookup;
  };

  GraphQLEnumType.prototype.toString = function toString() {
    return this.name;
  };

  return GraphQLEnumType;
}();

// Also provide toJSON and inspect aliases for toString.
GraphQLEnumType.prototype.toJSON = GraphQLEnumType.prototype.inspect = GraphQLEnumType.prototype.toString;

function defineEnumValues(type, valueMap /* <T> */
) {
  !isPlainObj(valueMap) ? invariant(0, type.name + ' values must be an object with value names as keys.') : void 0;
  return Object.keys(valueMap).map(function (valueName) {
    var value = valueMap[valueName];
    !isPlainObj(value) ? invariant(0, type.name + '.' + valueName + ' must refer to an object with a "value" key ' + ('representing an internal value but got: ' + String(value) + '.')) : void 0;
    !!value.hasOwnProperty('isDeprecated') ? invariant(0, type.name + '.' + valueName + ' should provide "deprecationReason" instead ' + 'of "isDeprecated".') : void 0;
    return {
      name: valueName,
      description: value.description,
      isDeprecated: Boolean(value.deprecationReason),
      deprecationReason: value.deprecationReason,
      astNode: value.astNode,
      value: value.hasOwnProperty('value') ? value.value : valueName
    };
  });
} /* <T> */


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
export var GraphQLInputObjectType = function () {
  function GraphQLInputObjectType(config) {
    _classCallCheck(this, GraphQLInputObjectType);

    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this._typeConfig = config;
    !(typeof config.name === 'string') ? invariant(0, 'Must provide name.') : void 0;
  }

  GraphQLInputObjectType.prototype.getFields = function getFields() {
    return this._fields || (this._fields = this._defineFieldMap());
  };

  GraphQLInputObjectType.prototype._defineFieldMap = function _defineFieldMap() {
    var _this = this;

    var fieldMap = resolveThunk(this._typeConfig.fields) || {};
    !isPlainObj(fieldMap) ? invariant(0, this.name + ' fields must be an object with field names as keys or a ' + 'function which returns such an object.') : void 0;
    var resultFieldMap = Object.create(null);
    Object.keys(fieldMap).forEach(function (fieldName) {
      var field = _extends({}, fieldMap[fieldName], {
        name: fieldName
      });
      !!field.hasOwnProperty('resolve') ? invariant(0, _this.name + '.' + fieldName + ' field type has a resolve property, but ' + 'Input Types cannot define resolvers.') : void 0;
      resultFieldMap[fieldName] = field;
    });
    return resultFieldMap;
  };

  GraphQLInputObjectType.prototype.toString = function toString() {
    return this.name;
  };

  return GraphQLInputObjectType;
}();

// Also provide toJSON and inspect aliases for toString.
GraphQLInputObjectType.prototype.toJSON = GraphQLInputObjectType.prototype.toString;
GraphQLInputObjectType.prototype.inspect = GraphQLInputObjectType.prototype.toString;