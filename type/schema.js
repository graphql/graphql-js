"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isSchema = isSchema;
exports.assertSchema = assertSchema;
exports.GraphQLSchema = void 0;

var _find = _interopRequireDefault(require("../polyfills/find"));

var _objectValues = _interopRequireDefault(require("../polyfills/objectValues"));

var _inspect = _interopRequireDefault(require("../jsutils/inspect"));

var _devAssert = _interopRequireDefault(require("../jsutils/devAssert"));

var _instanceOf = _interopRequireDefault(require("../jsutils/instanceOf"));

var _isObjectLike = _interopRequireDefault(require("../jsutils/isObjectLike"));

var _defineToStringTag = _interopRequireDefault(require("../jsutils/defineToStringTag"));

var _introspection = require("./introspection");

var _directives = require("./directives");

var _definition = require("./definition");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// eslint-disable-next-line no-redeclare
function isSchema(schema) {
  return (0, _instanceOf.default)(schema, GraphQLSchema);
}

function assertSchema(schema) {
  if (!isSchema(schema)) {
    throw new Error("Expected ".concat((0, _inspect.default)(schema), " to be a GraphQL schema."));
  }

  return schema;
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
 * Note: When the schema is constructed, by default only the types that are
 * reachable by traversing the root types are included, other types must be
 * explicitly referenced.
 *
 * Example:
 *
 *     const characterInterface = new GraphQLInterfaceType({
 *       name: 'Character',
 *       ...
 *     });
 *
 *     const humanType = new GraphQLObjectType({
 *       name: 'Human',
 *       interfaces: [characterInterface],
 *       ...
 *     });
 *
 *     const droidType = new GraphQLObjectType({
 *       name: 'Droid',
 *       interfaces: [characterInterface],
 *       ...
 *     });
 *
 *     const schema = new GraphQLSchema({
 *       query: new GraphQLObjectType({
 *         name: 'Query',
 *         fields: {
 *           hero: { type: characterInterface, ... },
 *         }
 *       }),
 *       ...
 *       // Since this schema references only the `Character` interface it's
 *       // necessary to explicitly list the types that implement it if
 *       // you want them to be included in the final schema.
 *       types: [humanType, droidType],
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
    // If this schema was built from a source known to be valid, then it may be
    // marked with assumeValid to avoid an additional type system validation.
    if (config && config.assumeValid) {
      this.__validationErrors = [];
    } else {
      this.__validationErrors = undefined; // Otherwise check for common mistakes during construction to produce
      // clear and early error messages.

      (0, _isObjectLike.default)(config) || (0, _devAssert.default)(0, 'Must provide configuration object.');
      !config.types || Array.isArray(config.types) || (0, _devAssert.default)(0, "\"types\" must be Array if provided but got: ".concat((0, _inspect.default)(config.types), "."));
      !config.directives || Array.isArray(config.directives) || (0, _devAssert.default)(0, '"directives" must be Array if provided but got: ' + "".concat((0, _inspect.default)(config.directives), "."));
      !config.allowedLegacyNames || Array.isArray(config.allowedLegacyNames) || (0, _devAssert.default)(0, '"allowedLegacyNames" must be Array if provided but got: ' + "".concat((0, _inspect.default)(config.allowedLegacyNames), "."));
    }

    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes;
    this.__allowedLegacyNames = config.allowedLegacyNames || [];
    this._queryType = config.query;
    this._mutationType = config.mutation;
    this._subscriptionType = config.subscription; // Provide specified directives (e.g. @include and @skip) by default.

    this._directives = config.directives || _directives.specifiedDirectives; // Build type map now to detect any errors within this schema.

    var initialTypes = [this._queryType, this._mutationType, this._subscriptionType, _introspection.__Schema].concat(config.types); // Keep track of all types referenced within the schema.

    var typeMap = Object.create(null); // First by deeply visiting all initial types.

    typeMap = initialTypes.reduce(typeMapReducer, typeMap); // Then by deeply visiting all directive types.

    typeMap = this._directives.reduce(typeMapDirectiveReducer, typeMap); // Storing the resulting map for reference by the schema.

    this._typeMap = typeMap;
    this._possibleTypeMap = Object.create(null); // Keep track of all implementations by interface name.

    this._implementations = Object.create(null);
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = (0, _objectValues.default)(this._typeMap)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var type = _step.value;

        if ((0, _definition.isObjectType)(type)) {
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = type.getInterfaces()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
              var iface = _step2.value;

              if ((0, _definition.isInterfaceType)(iface)) {
                var impls = this._implementations[iface.name];

                if (impls) {
                  impls.push(type);
                } else {
                  this._implementations[iface.name] = [type];
                }
              }
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                _iterator2.return();
              }
            } finally {
              if (_didIteratorError2) {
                throw _iteratorError2;
              }
            }
          }
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return != null) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }
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

    return this._implementations[abstractType.name] || [];
  };

  _proto.isPossibleType = function isPossibleType(abstractType, possibleType) {
    if (this._possibleTypeMap[abstractType.name] == null) {
      var map = Object.create(null);
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = this.getPossibleTypes(abstractType)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var type = _step3.value;
          map[type.name] = true;
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      this._possibleTypeMap[abstractType.name] = map;
    }

    return Boolean(this._possibleTypeMap[abstractType.name][possibleType.name]);
  };

  _proto.getDirectives = function getDirectives() {
    return this._directives;
  };

  _proto.getDirective = function getDirective(name) {
    return (0, _find.default)(this.getDirectives(), function (directive) {
      return directive.name === name;
    });
  };

  _proto.toConfig = function toConfig() {
    return {
      query: this.getQueryType(),
      mutation: this.getMutationType(),
      subscription: this.getSubscriptionType(),
      types: (0, _objectValues.default)(this.getTypeMap()),
      directives: this.getDirectives().slice(),
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes || [],
      assumeValid: this.__validationErrors !== undefined,
      allowedLegacyNames: this.__allowedLegacyNames
    };
  };

  return GraphQLSchema;
}(); // Conditionally apply `[Symbol.toStringTag]` if `Symbol`s are supported


exports.GraphQLSchema = GraphQLSchema;
(0, _defineToStringTag.default)(GraphQLSchema);

function typeMapReducer(map, type) {
  if (!type) {
    return map;
  }

  var namedType = (0, _definition.getNamedType)(type);
  var seenType = map[namedType.name];

  if (seenType) {
    if (seenType !== namedType) {
      throw new Error("Schema must contain uniquely named types but contains multiple types named \"".concat(namedType.name, "\"."));
    }

    return map;
  }

  map[namedType.name] = namedType;
  var reducedMap = map;

  if ((0, _definition.isUnionType)(namedType)) {
    reducedMap = namedType.getTypes().reduce(typeMapReducer, reducedMap);
  }

  if ((0, _definition.isObjectType)(namedType)) {
    reducedMap = namedType.getInterfaces().reduce(typeMapReducer, reducedMap);
  }

  if ((0, _definition.isObjectType)(namedType) || (0, _definition.isInterfaceType)(namedType)) {
    var _iteratorNormalCompletion4 = true;
    var _didIteratorError4 = false;
    var _iteratorError4 = undefined;

    try {
      for (var _iterator4 = (0, _objectValues.default)(namedType.getFields())[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
        var field = _step4.value;
        var fieldArgTypes = field.args.map(function (arg) {
          return arg.type;
        });
        reducedMap = fieldArgTypes.reduce(typeMapReducer, reducedMap);
        reducedMap = typeMapReducer(reducedMap, field.type);
      }
    } catch (err) {
      _didIteratorError4 = true;
      _iteratorError4 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion4 && _iterator4.return != null) {
          _iterator4.return();
        }
      } finally {
        if (_didIteratorError4) {
          throw _iteratorError4;
        }
      }
    }
  }

  if ((0, _definition.isInputObjectType)(namedType)) {
    var _iteratorNormalCompletion5 = true;
    var _didIteratorError5 = false;
    var _iteratorError5 = undefined;

    try {
      for (var _iterator5 = (0, _objectValues.default)(namedType.getFields())[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
        var _field = _step5.value;
        reducedMap = typeMapReducer(reducedMap, _field.type);
      }
    } catch (err) {
      _didIteratorError5 = true;
      _iteratorError5 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion5 && _iterator5.return != null) {
          _iterator5.return();
        }
      } finally {
        if (_didIteratorError5) {
          throw _iteratorError5;
        }
      }
    }
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
