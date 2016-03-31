'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.GraphQLNonNull = exports.GraphQLList = exports.GraphQLInputObjectType = exports.GraphQLEnumType = exports.GraphQLUnionType = exports.GraphQLInterfaceType = exports.GraphQLObjectType = exports.GraphQLScalarType = undefined;

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

exports.isType = isType;
exports.isInputType = isInputType;
exports.isOutputType = isOutputType;
exports.isLeafType = isLeafType;
exports.isCompositeType = isCompositeType;
exports.isAbstractType = isAbstractType;
exports.getNullableType = getNullableType;
exports.getNamedType = getNamedType;

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _isNullish = require('../jsutils/isNullish');

var _isNullish2 = _interopRequireDefault(_isNullish);

var _kinds = require('../language/kinds');

var _assertValidName = require('../utilities/assertValidName');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Predicates

/**
 * These are all of the possible kinds of types.
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function isType(type) {
  return type instanceof GraphQLScalarType || type instanceof GraphQLObjectType || type instanceof GraphQLInterfaceType || type instanceof GraphQLUnionType || type instanceof GraphQLEnumType || type instanceof GraphQLInputObjectType || type instanceof GraphQLList || type instanceof GraphQLNonNull;
}

/**
 * These types may be used as input types for arguments and directives.
 */
function isInputType(type) {
  var namedType = getNamedType(type);
  return namedType instanceof GraphQLScalarType || namedType instanceof GraphQLEnumType || namedType instanceof GraphQLInputObjectType;
}

/**
 * These types may be used as output types as the result of fields.
 */
function isOutputType(type) {
  var namedType = getNamedType(type);
  return namedType instanceof GraphQLScalarType || namedType instanceof GraphQLObjectType || namedType instanceof GraphQLInterfaceType || namedType instanceof GraphQLUnionType || namedType instanceof GraphQLEnumType;
}

/**
 * These types may describe types which may be leaf values.
 */
function isLeafType(type) {
  var namedType = getNamedType(type);
  return namedType instanceof GraphQLScalarType || namedType instanceof GraphQLEnumType;
}

/**
 * These types may describe the parent context of a selection set.
 */
function isCompositeType(type) {
  return type instanceof GraphQLObjectType || type instanceof GraphQLInterfaceType || type instanceof GraphQLUnionType;
}

/**
 * These types may describe the parent context of a selection set.
 */
function isAbstractType(type) {
  return type instanceof GraphQLInterfaceType || type instanceof GraphQLUnionType;
}

/**
 * These types can all accept null as a value.
 */
function getNullableType(type) {
  return type instanceof GraphQLNonNull ? type.ofType : type;
}

/**
 * These named types do not include modifiers like List or NonNull.
 */
function getNamedType(type) {
  var unmodifiedType = type;
  while (unmodifiedType instanceof GraphQLList || unmodifiedType instanceof GraphQLNonNull) {
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

var GraphQLScalarType = exports.GraphQLScalarType = function () {
  function GraphQLScalarType(config) {
    (0, _classCallCheck3.default)(this, GraphQLScalarType);

    (0, _invariant2.default)(config.name, 'Type must be named.');
    (0, _assertValidName.assertValidName)(config.name);
    this.name = config.name;
    this.description = config.description;
    (0, _invariant2.default)(typeof config.serialize === 'function', this + ' must provide "serialize" function. If this custom Scalar is ' + 'also used as an input type, ensure "parseValue" and "parseLiteral" ' + 'functions are also provided.');
    if (config.parseValue || config.parseLiteral) {
      (0, _invariant2.default)(typeof config.parseValue === 'function' && typeof config.parseLiteral === 'function', this + ' must provide both "parseValue" and "parseLiteral" functions.');
    }
    this._scalarConfig = config;
  }

  (0, _createClass3.default)(GraphQLScalarType, [{
    key: 'serialize',
    value: function serialize(value) {
      var serializer = this._scalarConfig.serialize;
      return serializer(value);
    }
  }, {
    key: 'parseValue',
    value: function parseValue(value) {
      var parser = this._scalarConfig.parseValue;
      return parser ? parser(value) : null;
    }
  }, {
    key: 'parseLiteral',
    value: function parseLiteral(valueAST) {
      var parser = this._scalarConfig.parseLiteral;
      return parser ? parser(valueAST) : null;
    }
  }, {
    key: 'toString',
    value: function toString() {
      return this.name;
    }
  }]);
  return GraphQLScalarType;
}();

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

var GraphQLObjectType = exports.GraphQLObjectType = function () {
  function GraphQLObjectType(config) {
    (0, _classCallCheck3.default)(this, GraphQLObjectType);

    (0, _invariant2.default)(config.name, 'Type must be named.');
    (0, _assertValidName.assertValidName)(config.name);
    this.name = config.name;
    this.description = config.description;
    if (config.isTypeOf) {
      (0, _invariant2.default)(typeof config.isTypeOf === 'function', this + ' must provide "isTypeOf" as a function.');
    }
    this.isTypeOf = config.isTypeOf;
    this._typeConfig = config;
  }

  (0, _createClass3.default)(GraphQLObjectType, [{
    key: 'getFields',
    value: function getFields() {
      return this._fields || (this._fields = defineFieldMap(this, this._typeConfig.fields));
    }
  }, {
    key: 'getInterfaces',
    value: function getInterfaces() {
      return this._interfaces || (this._interfaces = defineInterfaces(this, this._typeConfig.interfaces));
    }
  }, {
    key: 'toString',
    value: function toString() {
      return this.name;
    }
  }]);
  return GraphQLObjectType;
}();

function resolveMaybeThunk(thingOrThunk) {
  return typeof thingOrThunk === 'function' ? thingOrThunk() : thingOrThunk;
}

function defineInterfaces(type, interfacesOrThunk) {
  var interfaces = resolveMaybeThunk(interfacesOrThunk);
  if (!interfaces) {
    return [];
  }
  (0, _invariant2.default)(Array.isArray(interfaces), type + ' interfaces must be an Array or a function which returns an Array.');
  interfaces.forEach(function (iface) {
    (0, _invariant2.default)(iface instanceof GraphQLInterfaceType, type + ' may only implement Interface types, it cannot ' + ('implement: ' + iface + '.'));
    if (typeof iface.resolveType !== 'function') {
      (0, _invariant2.default)(typeof type.isTypeOf === 'function', 'Interface Type ' + iface + ' does not provide a "resolveType" function ' + ('and implementing Type ' + type + ' does not provide a "isTypeOf" ') + 'function. There is no way to resolve this implementing type ' + 'during execution.');
    }
  });
  return interfaces;
}

function defineFieldMap(type, fields) {
  var fieldMap = resolveMaybeThunk(fields);
  (0, _invariant2.default)(isPlainObj(fieldMap), type + ' fields must be an object with field names as keys or a ' + 'function which returns such an object.');

  var fieldNames = (0, _keys2.default)(fieldMap);
  (0, _invariant2.default)(fieldNames.length > 0, type + ' fields must be an object with field names as keys or a ' + 'function which returns such an object.');

  var resultFieldMap = {};
  fieldNames.forEach(function (fieldName) {
    (0, _assertValidName.assertValidName)(fieldName);
    var field = (0, _extends3.default)({}, fieldMap[fieldName], {
      name: fieldName
    });
    (0, _invariant2.default)(!field.hasOwnProperty('isDeprecated'), type + '.' + fieldName + ' should provide "deprecationReason" instead ' + 'of "isDeprecated".');
    (0, _invariant2.default)(isOutputType(field.type), type + '.' + fieldName + ' field type must be Output Type but ' + ('got: ' + field.type + '.'));
    if (!field.args) {
      field.args = [];
    } else {
      (0, _invariant2.default)(isPlainObj(field.args), type + '.' + fieldName + ' args must be an object with argument names ' + 'as keys.');
      field.args = (0, _keys2.default)(field.args).map(function (argName) {
        (0, _assertValidName.assertValidName)(argName);
        var arg = field.args[argName];
        (0, _invariant2.default)(isInputType(arg.type), type + '.' + fieldName + '(' + argName + ':) argument type must be ' + ('Input Type but got: ' + arg.type + '.'));
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
  return obj && (typeof obj === 'undefined' ? 'undefined' : (0, _typeof3.default)(obj)) === 'object' && !Array.isArray(obj);
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

var GraphQLInterfaceType = exports.GraphQLInterfaceType = function () {
  function GraphQLInterfaceType(config) {
    (0, _classCallCheck3.default)(this, GraphQLInterfaceType);

    (0, _invariant2.default)(config.name, 'Type must be named.');
    (0, _assertValidName.assertValidName)(config.name);
    this.name = config.name;
    this.description = config.description;
    if (config.resolveType) {
      (0, _invariant2.default)(typeof config.resolveType === 'function', this + ' must provide "resolveType" as a function.');
    }
    this.resolveType = config.resolveType;
    this._typeConfig = config;
  }

  (0, _createClass3.default)(GraphQLInterfaceType, [{
    key: 'getFields',
    value: function getFields() {
      return this._fields || (this._fields = defineFieldMap(this, this._typeConfig.fields));
    }
  }, {
    key: 'toString',
    value: function toString() {
      return this.name;
    }
  }]);
  return GraphQLInterfaceType;
}();

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

var GraphQLUnionType = exports.GraphQLUnionType = function () {
  function GraphQLUnionType(config) {
    var _this = this;

    (0, _classCallCheck3.default)(this, GraphQLUnionType);

    (0, _invariant2.default)(config.name, 'Type must be named.');
    (0, _assertValidName.assertValidName)(config.name);
    this.name = config.name;
    this.description = config.description;
    if (config.resolveType) {
      (0, _invariant2.default)(typeof config.resolveType === 'function', this + ' must provide "resolveType" as a function.');
    }
    this.resolveType = config.resolveType;
    (0, _invariant2.default)(Array.isArray(config.types) && config.types.length > 0, 'Must provide Array of types for Union ' + config.name + '.');
    config.types.forEach(function (type) {
      (0, _invariant2.default)(type instanceof GraphQLObjectType, _this + ' may only contain Object types, it cannot contain: ' + type + '.');
      if (typeof _this.resolveType !== 'function') {
        (0, _invariant2.default)(typeof type.isTypeOf === 'function', 'Union Type ' + _this + ' does not provide a "resolveType" function ' + ('and possible Type ' + type + ' does not provide a "isTypeOf" ') + 'function. There is no way to resolve this possible type ' + 'during execution.');
      }
    });
    this._types = config.types;
    this._typeConfig = config;
  }

  (0, _createClass3.default)(GraphQLUnionType, [{
    key: 'getTypes',
    value: function getTypes() {
      return this._types;
    }
  }, {
    key: 'toString',
    value: function toString() {
      return this.name;
    }
  }]);
  return GraphQLUnionType;
}();

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

var GraphQLEnumType /* <T> */ = exports.GraphQLEnumType = function () {
  /* <T> */
  function GraphQLEnumType(config /* <T> */) {
    (0, _classCallCheck3.default)(this, GraphQLEnumType);

    this.name = config.name;
    (0, _assertValidName.assertValidName)(config.name);
    this.description = config.description;
    this._values = defineEnumValues(this, config.values);
    this._enumConfig = config;
  } /* <T> */

  (0, _createClass3.default)(GraphQLEnumType, [{
    key: 'getValues',
    value: function getValues() /* <T> */{
      return this._values;
    }
  }, {
    key: 'serialize',
    value: function serialize(value /* T */) {
      var enumValue = this._getValueLookup().get(value);
      return enumValue ? enumValue.name : null;
    }
  }, {
    key: 'parseValue',
    value: function parseValue(value) /* T */{
      if (typeof value === 'string') {
        var enumValue = this._getNameLookup()[value];
        if (enumValue) {
          return enumValue.value;
        }
      }
    }
  }, {
    key: 'parseLiteral',
    value: function parseLiteral(valueAST) /* T */{
      if (valueAST.kind === _kinds.ENUM) {
        var enumValue = this._getNameLookup()[valueAST.value];
        if (enumValue) {
          return enumValue.value;
        }
      }
    }
  }, {
    key: '_getValueLookup',
    value: function _getValueLookup() {
      var _this2 = this;

      if (!this._valueLookup) {
        (function () {
          var lookup = new _map2.default();
          _this2.getValues().forEach(function (value) {
            lookup.set(value.value, value);
          });
          _this2._valueLookup = lookup;
        })();
      }
      return this._valueLookup;
    }
  }, {
    key: '_getNameLookup',
    value: function _getNameLookup() {
      var _this3 = this;

      if (!this._nameLookup) {
        (function () {
          var lookup = (0, _create2.default)(null);
          _this3.getValues().forEach(function (value) {
            lookup[value.name] = value;
          });
          _this3._nameLookup = lookup;
        })();
      }
      return this._nameLookup;
    }
  }, {
    key: 'toString',
    value: function toString() {
      return this.name;
    }
  }]);
  return GraphQLEnumType;
}();

function defineEnumValues(type, valueMap /* <T> */
) /* <T> */{
  (0, _invariant2.default)(isPlainObj(valueMap), type + ' values must be an object with value names as keys.');
  var valueNames = (0, _keys2.default)(valueMap);
  (0, _invariant2.default)(valueNames.length > 0, type + ' values must be an object with value names as keys.');
  return valueNames.map(function (valueName) {
    (0, _assertValidName.assertValidName)(valueName);
    var value = valueMap[valueName];
    (0, _invariant2.default)(isPlainObj(value), type + '.' + valueName + ' must refer to an object with a "value" key ' + ('representing an internal value but got: ' + value + '.'));
    (0, _invariant2.default)(!value.hasOwnProperty('isDeprecated'), type + '.' + valueName + ' should provide "deprecationReason" instead ' + 'of "isDeprecated".');
    return {
      name: valueName,
      description: value.description,
      deprecationReason: value.deprecationReason,
      value: (0, _isNullish2.default)(value.value) ? valueName : value.value
    };
  });
} /* <T> */

/* T */

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

var GraphQLInputObjectType = exports.GraphQLInputObjectType = function () {
  function GraphQLInputObjectType(config) {
    (0, _classCallCheck3.default)(this, GraphQLInputObjectType);

    (0, _invariant2.default)(config.name, 'Type must be named.');
    (0, _assertValidName.assertValidName)(config.name);
    this.name = config.name;
    this.description = config.description;
    this._typeConfig = config;
  }

  (0, _createClass3.default)(GraphQLInputObjectType, [{
    key: 'getFields',
    value: function getFields() {
      return this._fields || (this._fields = this._defineFieldMap());
    }
  }, {
    key: '_defineFieldMap',
    value: function _defineFieldMap() {
      var _this4 = this;

      var fieldMap = resolveMaybeThunk(this._typeConfig.fields);
      (0, _invariant2.default)(isPlainObj(fieldMap), this + ' fields must be an object with field names as keys or a ' + 'function which returns such an object.');
      var fieldNames = (0, _keys2.default)(fieldMap);
      (0, _invariant2.default)(fieldNames.length > 0, this + ' fields must be an object with field names as keys or a ' + 'function which returns such an object.');
      var resultFieldMap = {};
      fieldNames.forEach(function (fieldName) {
        (0, _assertValidName.assertValidName)(fieldName);
        var field = (0, _extends3.default)({}, fieldMap[fieldName], {
          name: fieldName
        });
        (0, _invariant2.default)(isInputType(field.type), _this4 + '.' + fieldName + ' field type must be Input Type but ' + ('got: ' + field.type + '.'));
        resultFieldMap[fieldName] = field;
      });
      return resultFieldMap;
    }
  }, {
    key: 'toString',
    value: function toString() {
      return this.name;
    }
  }]);
  return GraphQLInputObjectType;
}();

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

var GraphQLList = exports.GraphQLList = function () {
  function GraphQLList(type) {
    (0, _classCallCheck3.default)(this, GraphQLList);

    (0, _invariant2.default)(isType(type), 'Can only create List of a GraphQLType but got: ' + type + '.');
    this.ofType = type;
  }

  (0, _createClass3.default)(GraphQLList, [{
    key: 'toString',
    value: function toString() {
      return '[' + String(this.ofType) + ']';
    }
  }]);
  return GraphQLList;
}();

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


var GraphQLNonNull = exports.GraphQLNonNull = function () {
  function GraphQLNonNull(type) {
    (0, _classCallCheck3.default)(this, GraphQLNonNull);

    (0, _invariant2.default)(isType(type) && !(type instanceof GraphQLNonNull), 'Can only create NonNull of a Nullable GraphQLType but got: ' + type + '.');
    this.ofType = type;
  }

  (0, _createClass3.default)(GraphQLNonNull, [{
    key: 'toString',
    value: function toString() {
      return this.ofType.toString() + '!';
    }
  }]);
  return GraphQLNonNull;
}();