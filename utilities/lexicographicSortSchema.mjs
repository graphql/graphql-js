var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

import keyValMap from '../jsutils/keyValMap'; /**
                                               * Copyright (c) 2015-present, Facebook, Inc.
                                               *
                                               * This source code is licensed under the MIT license found in the
                                               * LICENSE file in the root directory of this source tree.
                                               *
                                               *  strict
                                               */

import objectValues from '../jsutils/objectValues';
import { GraphQLSchema } from '../type/schema';
import { GraphQLDirective } from '../type/directives';
import { GraphQLList, GraphQLNonNull } from '../type/wrappers';

import { GraphQLObjectType, GraphQLInterfaceType, GraphQLUnionType, GraphQLEnumType, GraphQLInputObjectType, isListType, isNonNullType, isScalarType, isObjectType, isInterfaceType, isUnionType, isEnumType, isInputObjectType } from '../type/definition';
import { isSpecifiedScalarType } from '../type/scalars';
import { isIntrospectionType } from '../type/introspection';

/**
 * Sort GraphQLSchema.
 */
export function lexicographicSortSchema(schema) {
  var cache = Object.create(null);

  var sortMaybeType = function sortMaybeType(maybeType) {
    return maybeType && sortNamedType(maybeType);
  };
  return new GraphQLSchema({
    types: sortTypes(objectValues(schema.getTypeMap())),
    directives: sortByName(schema.getDirectives()).map(sortDirective),
    query: sortMaybeType(schema.getQueryType()),
    mutation: sortMaybeType(schema.getMutationType()),
    subscription: sortMaybeType(schema.getSubscriptionType()),
    astNode: schema.astNode
  });

  function sortDirective(directive) {
    return new GraphQLDirective({
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
    return keyValMap(sortByName(args), function (arg) {
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
    if (isListType(type)) {
      return new GraphQLList(sortType(type.ofType));
    } else if (isNonNullType(type)) {
      return new GraphQLNonNull(sortType(type.ofType));
    }
    return sortNamedType(type);
  }

  function sortTypes(arr) {
    return sortByName(arr).map(sortNamedType);
  }

  function sortNamedType(type) {
    if (isSpecifiedScalarType(type) || isIntrospectionType(type)) {
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
    if (isScalarType(type)) {
      return type;
    } else if (isObjectType(type)) {
      return new GraphQLObjectType({
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
    } else if (isInterfaceType(type)) {
      return new GraphQLInterfaceType({
        name: type.name,
        fields: function fields() {
          return sortFields(type.getFields());
        },
        resolveType: type.resolveType,
        description: type.description,
        astNode: type.astNode,
        extensionASTNodes: type.extensionASTNodes
      });
    } else if (isUnionType(type)) {
      return new GraphQLUnionType({
        name: type.name,
        types: function types() {
          return sortTypes(type.getTypes());
        },
        resolveType: type.resolveType,
        description: type.description,
        astNode: type.astNode
      });
    } else if (isEnumType(type)) {
      return new GraphQLEnumType({
        name: type.name,
        values: keyValMap(sortByName(type.getValues()), function (val) {
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
    } else if (isInputObjectType(type)) {
      return new GraphQLInputObjectType({
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