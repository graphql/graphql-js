"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isSchema = isSchema;
exports.GraphQLSchema = void 0;

var _definition = require("./definition");

var _directives = require("./directives");

var _inspect = _interopRequireDefault(require("../jsutils/inspect"));

var _introspection = require("./introspection");

var _applyToStringTag = _interopRequireDefault(require("../jsutils/applyToStringTag"));

var _find = _interopRequireDefault(require("../jsutils/find"));

var _instanceOf = _interopRequireDefault(require("../jsutils/instanceOf"));

var _invariant = _interopRequireDefault(require("../jsutils/invariant"));

var _objectValues = _interopRequireDefault(require("../jsutils/objectValues"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// eslint-disable-next-line no-redeclare
function isSchema(schema) {
  return (0, _instanceOf.default)(schema, GraphQLSchema);
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


var GraphQLSchema =
/*#__PURE__*/
function () {
  // Used as a cache for validateSchema().
  // Referenced by validateSchema().
  function GraphQLSchema(config) {
    var _this = this;

    _defineProperty(this, "astNode", void 0);

    _defineProperty(this, "extensionASTNodes", void 0);

    _defineProperty(this, "_queryType", void 0);

    _defineProperty(this, "_mutationType", void 0);

    _defineProperty(this, "_subscriptionType", void 0);

    _defineProperty(this, "_directives", void 0);

    _defineProperty(this, "_typeMap", void 0);

    _defineProperty(this, "_implementations", void 0);

    _defineProperty(this, "_possibleTypeMap", void 0);

    _defineProperty(this, "__validationErrors", void 0);

    _defineProperty(this, "__allowedLegacyNames", void 0);

    // If this schema was built from a source known to be valid, then it may be
    // marked with assumeValid to avoid an additional type system validation.
    if (config && config.assumeValid) {
      this.__validationErrors = [];
    } else {
      // Otherwise check for common mistakes during construction to produce
      // clear and early error messages.
      !(_typeof(config) === 'object') ? (0, _invariant.default)(0, 'Must provide configuration object.') : void 0;
      !(!config.types || Array.isArray(config.types)) ? (0, _invariant.default)(0, "\"types\" must be Array if provided but got: ".concat((0, _inspect.default)(config.types), ".")) : void 0;
      !(!config.directives || Array.isArray(config.directives)) ? (0, _invariant.default)(0, '"directives" must be Array if provided but got: ' + "".concat((0, _inspect.default)(config.directives), ".")) : void 0;
      !(!config.allowedLegacyNames || Array.isArray(config.allowedLegacyNames)) ? (0, _invariant.default)(0, '"allowedLegacyNames" must be Array if provided but got: ' + "".concat((0, _inspect.default)(config.allowedLegacyNames), ".")) : void 0;
    }

    this.__allowedLegacyNames = config.allowedLegacyNames || [];
    this._queryType = config.query;
    this._mutationType = config.mutation;
    this._subscriptionType = config.subscription; // Provide specified directives (e.g. @include and @skip) by default.

    this._directives = config.directives || _directives.specifiedDirectives;
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes; // Build type map now to detect any errors within this schema.

    var initialTypes = [this.getQueryType(), this.getMutationType(), this.getSubscriptionType(), _introspection.__Schema];
    var types = config.types;

    if (types) {
      initialTypes = initialTypes.concat(types);
    } // Keep track of all types referenced within the schema.


    var typeMap = Object.create(null); // First by deeply visiting all initial types.

    typeMap = initialTypes.reduce(typeMapReducer, typeMap); // Then by deeply visiting all directive types.

    typeMap = this._directives.reduce(typeMapDirectiveReducer, typeMap); // Storing the resulting map for reference by the schema.

    this._typeMap = typeMap; // Keep track of all implementations by interface name.

    this._implementations = Object.create(null);
    Object.keys(this._typeMap).forEach(function (typeName) {
      var type = _this._typeMap[typeName];

      if ((0, _definition.isObjectType)(type)) {
        type.getInterfaces().forEach(function (iface) {
          if ((0, _definition.isInterfaceType)(iface)) {
            var impls = _this._implementations[iface.name];

            if (impls) {
              impls.push(type);
            } else {
              _this._implementations[iface.name] = [type];
            }
          }
        });
      } else if ((0, _definition.isAbstractType)(type) && !_this._implementations[type.name]) {
        _this._implementations[type.name] = [];
      }
    });
  }

  var _proto = GraphQLSchema.prototype;

  _proto.getQueryType = function getQueryType() {
    return this._queryType;
  };

  _proto.getMutationType = function getMutationType() {
    return this._mutationType;
  };

  _proto.getSubscriptionType = function getSubscriptionType() {
    return this._subscriptionType;
  };

  _proto.getTypeMap = function getTypeMap() {
    return this._typeMap;
  };

  _proto.getType = function getType(name) {
    return this.getTypeMap()[name];
  };

  _proto.getPossibleTypes = function getPossibleTypes(abstractType) {
    if ((0, _definition.isUnionType)(abstractType)) {
      return abstractType.getTypes();
    }

    return this._implementations[abstractType.name];
  };

  _proto.isPossibleType = function isPossibleType(abstractType, possibleType) {
    var possibleTypeMap = this._possibleTypeMap;

    if (!possibleTypeMap) {
      this._possibleTypeMap = possibleTypeMap = Object.create(null);
    }

    if (!possibleTypeMap[abstractType.name]) {
      var possibleTypes = this.getPossibleTypes(abstractType);
      possibleTypeMap[abstractType.name] = possibleTypes.reduce(function (map, type) {
        return map[type.name] = true, map;
      }, Object.create(null));
    }

    return Boolean(possibleTypeMap[abstractType.name][possibleType.name]);
  };

  _proto.getDirectives = function getDirectives() {
    return this._directives;
  };

  _proto.getDirective = function getDirective(name) {
    return (0, _find.default)(this.getDirectives(), function (directive) {
      return directive.name === name;
    });
  };

  return GraphQLSchema;
}(); // Conditionally apply `[Symbol.toStringTag]` if `Symbol`s are supported


exports.GraphQLSchema = GraphQLSchema;
(0, _applyToStringTag.default)(GraphQLSchema);

function typeMapReducer(map, type) {
  if (!type) {
    return map;
  }

  if ((0, _definition.isWrappingType)(type)) {
    return typeMapReducer(map, type.ofType);
  }

  if (map[type.name]) {
    !(map[type.name] === type) ? (0, _invariant.default)(0, 'Schema must contain unique named types but contains multiple ' + "types named \"".concat(type.name, "\".")) : void 0;
    return map;
  }

  map[type.name] = type;
  var reducedMap = map;

  if ((0, _definition.isUnionType)(type)) {
    reducedMap = type.getTypes().reduce(typeMapReducer, reducedMap);
  }

  if ((0, _definition.isObjectType)(type)) {
    reducedMap = type.getInterfaces().reduce(typeMapReducer, reducedMap);
  }

  if ((0, _definition.isObjectType)(type) || (0, _definition.isInterfaceType)(type)) {
    (0, _objectValues.default)(type.getFields()).forEach(function (field) {
      if (field.args) {
        var fieldArgTypes = field.args.map(function (arg) {
          return arg.type;
        });
        reducedMap = fieldArgTypes.reduce(typeMapReducer, reducedMap);
      }

      reducedMap = typeMapReducer(reducedMap, field.type);
    });
  }

  if ((0, _definition.isInputObjectType)(type)) {
    (0, _objectValues.default)(type.getFields()).forEach(function (field) {
      reducedMap = typeMapReducer(reducedMap, field.type);
    });
  }

  return reducedMap;
}

function typeMapDirectiveReducer(map, directive) {
  // Directives are not validated until validateSchema() is called.
  if (!(0, _directives.isDirective)(directive)) {
    return map;
  }

  return directive.args.reduce(function (_map, arg) {
    return typeMapReducer(_map, arg.type);
  }, map);
}