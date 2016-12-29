'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.GraphQLSchema = undefined;

var _definition = require('./definition');

var _directives = require('./directives');

var _introspection = require('./introspection');

var _find = require('../jsutils/find');

var _find2 = _interopRequireDefault(_find);

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _typeComparators = require('../utilities/typeComparators');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

/**
 * Schema Definition
 *
 * A Schema is created by supplying the root types of each type of operation,
 * query and mutation (optional). A schema definition is then supplied to the
 * validator and executor.
 *
 * Example:
 *
 *     const MyAppSchema = new GraphQLSchema({
 *       query: MyAppQueryRootType,
 *       mutation: MyAppMutationRootType,
 *     })
 *
 * Note: If an array of `directives` are provided to GraphQLSchema, that will be
 * the exact list of directives represented and allowed. If `directives` is not
 * provided then a default set of the specified directives (e.g. @include and
 * @skip) will be used. If you wish to provide *additional* directives to these
 * specified directives, you must explicitly declare them. Example:
 *
 *     const MyAppSchema = new GraphQLSchema({
 *       ...
 *       directives: specifiedDirectives.concat([ myCustomDirective ]),
 *     })
 *
 */
var GraphQLSchema = exports.GraphQLSchema = function () {
  function GraphQLSchema(config) {
    var _this = this;

    _classCallCheck(this, GraphQLSchema);

    (0, _invariant2.default)(typeof config === 'object', 'Must provide configuration object.');

    (0, _invariant2.default)(config.query instanceof _definition.GraphQLObjectType, 'Schema query must be Object Type but got: ' + String(config.query) + '.');
    this._queryType = config.query;

    (0, _invariant2.default)(!config.mutation || config.mutation instanceof _definition.GraphQLObjectType, 'Schema mutation must be Object Type if provided but got: ' + String(config.mutation) + '.');
    this._mutationType = config.mutation;

    (0, _invariant2.default)(!config.subscription || config.subscription instanceof _definition.GraphQLObjectType, 'Schema subscription must be Object Type if provided but got: ' + String(config.subscription) + '.');
    this._subscriptionType = config.subscription;

    (0, _invariant2.default)(!config.types || Array.isArray(config.types), 'Schema types must be Array if provided but got: ' + String(config.types) + '.');

    (0, _invariant2.default)(!config.directives || Array.isArray(config.directives) && config.directives.every(function (directive) {
      return directive instanceof _directives.GraphQLDirective;
    }), 'Schema directives must be Array<GraphQLDirective> if provided but got: ' + String(config.directives) + '.');
    // Provide specified directives (e.g. @include and @skip) by default.
    this._directives = config.directives || _directives.specifiedDirectives;

    // Build type map now to detect any errors within this schema.
    var initialTypes = [this.getQueryType(), this.getMutationType(), this.getSubscriptionType(), _introspection.__Schema];

    var types = config.types;
    if (types) {
      initialTypes = initialTypes.concat(types);
    }

    this._typeMap = initialTypes.reduce(typeMapReducer, Object.create(null));

    // Keep track of all implementations by interface name.
    this._implementations = Object.create(null);
    Object.keys(this._typeMap).forEach(function (typeName) {
      var type = _this._typeMap[typeName];
      if (type instanceof _definition.GraphQLObjectType) {
        type.getInterfaces().forEach(function (iface) {
          var impls = _this._implementations[iface.name];
          if (impls) {
            impls.push(type);
          } else {
            _this._implementations[iface.name] = [type];
          }
        });
      }
    });

    // Enforce correct interface implementations.
    Object.keys(this._typeMap).forEach(function (typeName) {
      var type = _this._typeMap[typeName];
      if (type instanceof _definition.GraphQLObjectType) {
        type.getInterfaces().forEach(function (iface) {
          return assertObjectImplementsInterface(_this, type, iface);
        });
      }
    });
  }

  GraphQLSchema.prototype.getQueryType = function getQueryType() {
    return this._queryType;
  };

  GraphQLSchema.prototype.getMutationType = function getMutationType() {
    return this._mutationType;
  };

  GraphQLSchema.prototype.getSubscriptionType = function getSubscriptionType() {
    return this._subscriptionType;
  };

  GraphQLSchema.prototype.getTypeMap = function getTypeMap() {
    return this._typeMap;
  };

  GraphQLSchema.prototype.getType = function getType(name) {
    return this.getTypeMap()[name];
  };

  GraphQLSchema.prototype.getPossibleTypes = function getPossibleTypes(abstractType) {
    if (abstractType instanceof _definition.GraphQLUnionType) {
      return abstractType.getTypes();
    }
    (0, _invariant2.default)(abstractType instanceof _definition.GraphQLInterfaceType);
    return this._implementations[abstractType.name];
  };

  GraphQLSchema.prototype.isPossibleType = function isPossibleType(abstractType, possibleType) {
    var possibleTypeMap = this._possibleTypeMap;
    if (!possibleTypeMap) {
      this._possibleTypeMap = possibleTypeMap = Object.create(null);
    }

    if (!possibleTypeMap[abstractType.name]) {
      var possibleTypes = this.getPossibleTypes(abstractType);
      (0, _invariant2.default)(Array.isArray(possibleTypes), 'Could not find possible implementing types for ' + abstractType.name + ' ' + 'in schema. Check that schema.types is defined and is an array of ' + 'all possible types in the schema.');
      possibleTypeMap[abstractType.name] = possibleTypes.reduce(function (map, type) {
        return map[type.name] = true, map;
      }, Object.create(null));
    }

    return Boolean(possibleTypeMap[abstractType.name][possibleType.name]);
  };

  GraphQLSchema.prototype.getDirectives = function getDirectives() {
    return this._directives;
  };

  GraphQLSchema.prototype.getDirective = function getDirective(name) {
    return (0, _find2.default)(this.getDirectives(), function (directive) {
      return directive.name === name;
    });
  };

  return GraphQLSchema;
}();

function typeMapReducer(map, type) {
  if (!type) {
    return map;
  }
  if (type instanceof _definition.GraphQLList || type instanceof _definition.GraphQLNonNull) {
    return typeMapReducer(map, type.ofType);
  }
  if (map[type.name]) {
    (0, _invariant2.default)(map[type.name] === type, 'Schema must contain unique named types but contains multiple ' + ('types named "' + type.name + '".'));
    return map;
  }
  map[type.name] = type;

  var reducedMap = map;

  if (type instanceof _definition.GraphQLUnionType) {
    reducedMap = type.getTypes().reduce(typeMapReducer, reducedMap);
  }

  if (type instanceof _definition.GraphQLObjectType) {
    reducedMap = type.getInterfaces().reduce(typeMapReducer, reducedMap);
  }

  if (type instanceof _definition.GraphQLObjectType || type instanceof _definition.GraphQLInterfaceType) {
    (function () {
      var fieldMap = type.getFields();
      Object.keys(fieldMap).forEach(function (fieldName) {
        var field = fieldMap[fieldName];

        if (field.args) {
          var fieldArgTypes = field.args.map(function (arg) {
            return arg.type;
          });
          reducedMap = fieldArgTypes.reduce(typeMapReducer, reducedMap);
        }
        reducedMap = typeMapReducer(reducedMap, field.type);
      });
    })();
  }

  if (type instanceof _definition.GraphQLInputObjectType) {
    (function () {
      var fieldMap = type.getFields();
      Object.keys(fieldMap).forEach(function (fieldName) {
        var field = fieldMap[fieldName];
        reducedMap = typeMapReducer(reducedMap, field.type);
      });
    })();
  }

  return reducedMap;
}

function assertObjectImplementsInterface(schema, object, iface) {
  var objectFieldMap = object.getFields();
  var ifaceFieldMap = iface.getFields();

  // Assert each interface field is implemented.
  Object.keys(ifaceFieldMap).forEach(function (fieldName) {
    var objectField = objectFieldMap[fieldName];
    var ifaceField = ifaceFieldMap[fieldName];

    // Assert interface field exists on object.
    (0, _invariant2.default)(objectField, '"' + iface.name + '" expects field "' + fieldName + '" but "' + object.name + '" ' + 'does not provide it.');

    // Assert interface field type is satisfied by object field type, by being
    // a valid subtype. (covariant)
    (0, _invariant2.default)((0, _typeComparators.isTypeSubTypeOf)(schema, objectField.type, ifaceField.type), iface.name + '.' + fieldName + ' expects type "' + String(ifaceField.type) + '" ' + 'but ' + (object.name + '.' + fieldName + ' provides type "' + String(objectField.type) + '".'));

    // Assert each interface field arg is implemented.
    ifaceField.args.forEach(function (ifaceArg) {
      var argName = ifaceArg.name;
      var objectArg = (0, _find2.default)(objectField.args, function (arg) {
        return arg.name === argName;
      });

      // Assert interface field arg exists on object field.
      (0, _invariant2.default)(objectArg, iface.name + '.' + fieldName + ' expects argument "' + argName + '" but ' + (object.name + '.' + fieldName + ' does not provide it.'));

      // Assert interface field arg type matches object field arg type.
      // (invariant)
      (0, _invariant2.default)((0, _typeComparators.isEqualType)(ifaceArg.type, objectArg.type), iface.name + '.' + fieldName + '(' + argName + ':) expects type ' + ('"' + String(ifaceArg.type) + '" but ') + (object.name + '.' + fieldName + '(' + argName + ':) provides type ') + ('"' + String(objectArg.type) + '".'));
    });

    // Assert additional arguments must not be required.
    objectField.args.forEach(function (objectArg) {
      var argName = objectArg.name;
      var ifaceArg = (0, _find2.default)(ifaceField.args, function (arg) {
        return arg.name === argName;
      });
      if (!ifaceArg) {
        (0, _invariant2.default)(!(objectArg.type instanceof _definition.GraphQLNonNull), object.name + '.' + fieldName + '(' + argName + ':) is of required type ' + ('"' + String(objectArg.type) + '" but is not also provided by the ') + ('interface ' + iface.name + '.' + fieldName + '.'));
      }
    });
  });
}