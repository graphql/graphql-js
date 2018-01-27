var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

import { isObjectType, isInterfaceType, isUnionType, isInputObjectType, isWrappingType } from './definition';

import { GraphQLDirective, isDirective, specifiedDirectives } from './directives';

import { __Schema } from './introspection';
import find from '../jsutils/find';
import instanceOf from '../jsutils/instanceOf';
import invariant from '../jsutils/invariant';
import objectValues from '../jsutils/objectValues';

/**
 * Test if the given value is a GraphQL schema.
 */

// eslint-disable-next-line no-redeclare
export function isSchema(schema) {
  return instanceOf(schema, GraphQLSchema);
}

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
export var GraphQLSchema = function () {
  // Used as a cache for validateSchema().
  function GraphQLSchema(config) {
    var _this = this;

    _classCallCheck(this, GraphQLSchema);

    // If this schema was built from a source known to be valid, then it may be
    // marked with assumeValid to avoid an additional type system validation.
    if (config && config.assumeValid) {
      this.__validationErrors = [];
    } else {
      // Otherwise check for common mistakes during construction to produce
      // clear and early error messages.
      !((typeof config === 'undefined' ? 'undefined' : _typeof(config)) === 'object') ? invariant(0, 'Must provide configuration object.') : void 0;
      !(!config.types || Array.isArray(config.types)) ? invariant(0, '"types" must be Array if provided but got: ' + String(config.types) + '.') : void 0;
      !(!config.directives || Array.isArray(config.directives)) ? invariant(0, '"directives" must be Array if provided but got: ' + (String(config.directives) + '.')) : void 0;
      !(!config.allowedLegacyNames || Array.isArray(config.allowedLegacyNames)) ? invariant(0, '"allowedLegacyNames" must be Array if provided but got: ' + (String(config.allowedLegacyNames) + '.')) : void 0;
      this.__allowedLegacyNames = config.allowedLegacyNames;
    }

    this._queryType = config.query;
    this._mutationType = config.mutation;
    this._subscriptionType = config.subscription;
    // Provide specified directives (e.g. @include and @skip) by default.
    this._directives = config.directives || specifiedDirectives;
    this.astNode = config.astNode;

    // Build type map now to detect any errors within this schema.
    var initialTypes = [this.getQueryType(), this.getMutationType(), this.getSubscriptionType(), __Schema];

    var types = config.types;
    if (types) {
      initialTypes = initialTypes.concat(types);
    }

    // Keep track of all types referenced within the schema.
    var typeMap = Object.create(null);

    // First by deeply visiting all initial types.
    typeMap = initialTypes.reduce(typeMapReducer, typeMap);

    // Then by deeply visiting all directive types.
    typeMap = this._directives.reduce(typeMapDirectiveReducer, typeMap);

    // Storing the resulting map for reference by the schema.
    this._typeMap = typeMap;

    // Keep track of all implementations by interface name.
    this._implementations = Object.create(null);
    Object.keys(this._typeMap).forEach(function (typeName) {
      var type = _this._typeMap[typeName];
      if (isObjectType(type)) {
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
  }
  // Referenced by validateSchema().


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
    if (isUnionType(abstractType)) {
      return abstractType.getTypes();
    }
    return this._implementations[abstractType.name];
  };

  GraphQLSchema.prototype.isPossibleType = function isPossibleType(abstractType, possibleType) {
    var possibleTypeMap = this._possibleTypeMap;
    if (!possibleTypeMap) {
      this._possibleTypeMap = possibleTypeMap = Object.create(null);
    }

    if (!possibleTypeMap[abstractType.name]) {
      var possibleTypes = this.getPossibleTypes(abstractType);
      !Array.isArray(possibleTypes) ? invariant(0, 'Could not find possible implementing types for ' + abstractType.name + ' ' + 'in schema. Check that schema.types is defined and is an array of ' + 'all possible types in the schema.') : void 0;
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
    return find(this.getDirectives(), function (directive) {
      return directive.name === name;
    });
  };

  return GraphQLSchema;
}();

function typeMapReducer(map, type) {
  if (!type) {
    return map;
  }
  if (isWrappingType(type)) {
    return typeMapReducer(map, type.ofType);
  }
  if (map[type.name]) {
    !(map[type.name] === type) ? invariant(0, 'Schema must contain unique named types but contains multiple ' + ('types named "' + type.name + '".')) : void 0;
    return map;
  }
  map[type.name] = type;

  var reducedMap = map;

  if (isUnionType(type)) {
    reducedMap = type.getTypes().reduce(typeMapReducer, reducedMap);
  }

  if (isObjectType(type)) {
    reducedMap = type.getInterfaces().reduce(typeMapReducer, reducedMap);
  }

  if (isObjectType(type) || isInterfaceType(type)) {
    objectValues(type.getFields()).forEach(function (field) {
      if (field.args) {
        var fieldArgTypes = field.args.map(function (arg) {
          return arg.type;
        });
        reducedMap = fieldArgTypes.reduce(typeMapReducer, reducedMap);
      }
      reducedMap = typeMapReducer(reducedMap, field.type);
    });
  }

  if (isInputObjectType(type)) {
    objectValues(type.getFields()).forEach(function (field) {
      reducedMap = typeMapReducer(reducedMap, field.type);
    });
  }

  return reducedMap;
}

function typeMapDirectiveReducer(map, directive) {
  // Directives are not validated until validateSchema() is called.
  if (!isDirective(directive)) {
    return map;
  }
  return directive.args.reduce(function (_map, arg) {
    return typeMapReducer(_map, arg.type);
  }, map);
}