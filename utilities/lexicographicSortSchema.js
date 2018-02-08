'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Copyright (c) 2015-present, Facebook, Inc.
                                                                                                                                                                                                                                                                   *
                                                                                                                                                                                                                                                                   * This source code is licensed under the MIT license found in the
                                                                                                                                                                                                                                                                   * LICENSE file in the root directory of this source tree.
                                                                                                                                                                                                                                                                   *
                                                                                                                                                                                                                                                                   *  strict
                                                                                                                                                                                                                                                                   */

exports.lexicographicSortSchema = lexicographicSortSchema;

var _keyValMap = require('../jsutils/keyValMap');

var _keyValMap2 = _interopRequireDefault(_keyValMap);

var _objectValues = require('../jsutils/objectValues');

var _objectValues2 = _interopRequireDefault(_objectValues);

var _schema = require('../type/schema');

var _directives = require('../type/directives');

var _wrappers = require('../type/wrappers');

var _definition = require('../type/definition');

var _scalars = require('../type/scalars');

var _introspection = require('../type/introspection');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Sort GraphQLSchema.
 */
function lexicographicSortSchema(schema) {
  var cache = Object.create(null);

  var sortMaybeType = function sortMaybeType(maybeType) {
    return maybeType && sortNamedType(maybeType);
  };
  return new _schema.GraphQLSchema({
    types: sortTypes((0, _objectValues2.default)(schema.getTypeMap())),
    directives: sortByName(schema.getDirectives()).map(sortDirective),
    query: sortMaybeType(schema.getQueryType()),
    mutation: sortMaybeType(schema.getMutationType()),
    subscription: sortMaybeType(schema.getSubscriptionType()),
    astNode: schema.astNode
  });

  function sortDirective(directive) {
    return new _directives.GraphQLDirective({
      name: directive.name,
      description: directive.description,
      locations: sortBy(directive.locations, function (x) {
        return x;
      }),
      args: sortArgs(directive.args),
      astNode: directive.astNode
    });
  }

  function sortArgs(args) {
    return (0, _keyValMap2.default)(sortByName(args), function (arg) {
      return arg.name;
    }, function (arg) {
      return _extends({}, arg, {
        type: sortType(arg.type)
      });
    });
  }

  function sortFields(fieldsMap) {
    return sortObjMap(fieldsMap, function (field) {
      return {
        type: sortType(field.type),
        args: sortArgs(field.args),
        resolve: field.resolve,
        subscribe: field.subscribe,
        deprecationReason: field.deprecationReason,
        description: field.description,
        astNode: field.astNode
      };
    });
  }

  function sortInputFields(fieldsMap) {
    return sortObjMap(fieldsMap, function (field) {
      return {
        type: sortType(field.type),
        defaultValue: field.defaultValue,
        description: field.description,
        astNode: field.astNode
      };
    });
  }

  function sortType(type) {
    if ((0, _definition.isListType)(type)) {
      return new _wrappers.GraphQLList(sortType(type.ofType));
    } else if ((0, _definition.isNonNullType)(type)) {
      return new _wrappers.GraphQLNonNull(sortType(type.ofType));
    }
    return sortNamedType(type);
  }

  function sortTypes(arr) {
    return sortByName(arr).map(sortNamedType);
  }

  function sortNamedType(type) {
    if ((0, _scalars.isSpecifiedScalarType)(type) || (0, _introspection.isIntrospectionType)(type)) {
      return type;
    }

    var sortedType = cache[type.name];
    if (!sortedType) {
      sortedType = sortNamedTypeImpl(type);
      cache[type.name] = sortedType;
    }
    return sortedType;
  }

  function sortNamedTypeImpl(type) {
    if ((0, _definition.isScalarType)(type)) {
      return type;
    } else if ((0, _definition.isObjectType)(type)) {
      return new _definition.GraphQLObjectType({
        name: type.name,
        interfaces: function interfaces() {
          return sortTypes(type.getInterfaces());
        },
        fields: function fields() {
          return sortFields(type.getFields());
        },
        isTypeOf: type.isTypeOf,
        description: type.description,
        astNode: type.astNode,
        extensionASTNodes: type.extensionASTNodes
      });
    } else if ((0, _definition.isInterfaceType)(type)) {
      return new _definition.GraphQLInterfaceType({
        name: type.name,
        fields: function fields() {
          return sortFields(type.getFields());
        },
        resolveType: type.resolveType,
        description: type.description,
        astNode: type.astNode,
        extensionASTNodes: type.extensionASTNodes
      });
    } else if ((0, _definition.isUnionType)(type)) {
      return new _definition.GraphQLUnionType({
        name: type.name,
        types: function types() {
          return sortTypes(type.getTypes());
        },
        resolveType: type.resolveType,
        description: type.description,
        astNode: type.astNode
      });
    } else if ((0, _definition.isEnumType)(type)) {
      return new _definition.GraphQLEnumType({
        name: type.name,
        values: (0, _keyValMap2.default)(sortByName(type.getValues()), function (val) {
          return val.name;
        }, function (val) {
          return {
            value: val.value,
            deprecationReason: val.deprecationReason,
            description: val.description,
            astNode: val.astNode
          };
        }),
        description: type.description,
        astNode: type.astNode
      });
    } else if ((0, _definition.isInputObjectType)(type)) {
      return new _definition.GraphQLInputObjectType({
        name: type.name,
        fields: function fields() {
          return sortInputFields(type.getFields());
        },
        description: type.description,
        astNode: type.astNode
      });
    }
    throw new Error('Unknown type: "' + type + '"');
  }
}

function sortObjMap(map, sortValueFn) {
  var sortedMap = Object.create(null);
  var sortedKeys = sortBy(Object.keys(map), function (x) {
    return x;
  });
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = sortedKeys[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var key = _step.value;

      var value = map[key];
      sortedMap[key] = sortValueFn ? sortValueFn(value) : value;
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return sortedMap;
}

function sortByName(array) {
  return sortBy(array, function (obj) {
    return obj.name;
  });
}

function sortBy(array, mapToKey) {
  return array.slice().sort(function (obj1, obj2) {
    var key1 = mapToKey(obj1);
    var key2 = mapToKey(obj2);
    return key1.localeCompare(key2);
  });
}