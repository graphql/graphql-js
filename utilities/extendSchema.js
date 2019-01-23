"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.extendSchema = extendSchema;

var _objectValues = _interopRequireDefault(require("../polyfills/objectValues"));

var _invariant = _interopRequireDefault(require("../jsutils/invariant"));

var _mapValue = _interopRequireDefault(require("../jsutils/mapValue"));

var _keyValMap = _interopRequireDefault(require("../jsutils/keyValMap"));

var _buildASTSchema = require("./buildASTSchema");

var _validate = require("../validation/validate");

var _schema = require("../type/schema");

var _introspection = require("../type/introspection");

var _scalars = require("../type/scalars");

var _definition = require("../type/definition");

var _directives = require("../type/directives");

var _kinds = require("../language/kinds");

var _predicates = require("../language/predicates");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * Produces a new schema given an existing schema and a document which may
 * contain GraphQL type extensions and definitions. The original schema will
 * remain unaltered.
 *
 * Because a schema represents a graph of references, a schema cannot be
 * extended without effectively making an entire copy. We do not know until it's
 * too late if subgraphs remain unchanged.
 *
 * This algorithm copies the provided schema, applying extensions while
 * producing the copy. The original schema remains unaltered.
 *
 * Accepts options as a third argument:
 *
 *    - commentDescriptions:
 *        Provide true to use preceding comments as the description.
 *
 */
function extendSchema(schema, documentAST, options) {
  (0, _schema.assertSchema)(schema);
  !(documentAST && documentAST.kind === _kinds.Kind.DOCUMENT) ? (0, _invariant.default)(0, 'Must provide valid Document AST') : void 0;

  if (!options || !(options.assumeValid || options.assumeValidSDL)) {
    (0, _validate.assertValidSDLExtension)(documentAST, schema);
  } // Collect the type definitions and extensions found in the document.


  var typeDefinitionMap = Object.create(null);
  var typeExtensionsMap = Object.create(null); // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".

  var directiveDefinitions = [];
  var schemaDef; // Schema extensions are collected which may add additional operation types.

  var schemaExtensions = [];
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = documentAST.definitions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var def = _step.value;

      if (def.kind === _kinds.Kind.SCHEMA_DEFINITION) {
        schemaDef = def;
      } else if (def.kind === _kinds.Kind.SCHEMA_EXTENSION) {
        schemaExtensions.push(def);
      } else if ((0, _predicates.isTypeDefinitionNode)(def)) {
        var typeName = def.name.value;
        typeDefinitionMap[typeName] = def;
      } else if ((0, _predicates.isTypeExtensionNode)(def)) {
        var extendedTypeName = def.name.value;
        var existingTypeExtensions = typeExtensionsMap[extendedTypeName];
        typeExtensionsMap[extendedTypeName] = existingTypeExtensions ? existingTypeExtensions.concat([def]) : [def];
      } else if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
        directiveDefinitions.push(def);
      }
    } // If this document contains no new types, extensions, or directives then
    // return the same unmodified GraphQLSchema instance.

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

  if (Object.keys(typeExtensionsMap).length === 0 && Object.keys(typeDefinitionMap).length === 0 && directiveDefinitions.length === 0 && schemaExtensions.length === 0 && !schemaDef) {
    return schema;
  }

  var astBuilder = new _buildASTSchema.ASTDefinitionBuilder(typeDefinitionMap, options, function (typeName) {
    var existingType = schema.getType(typeName);
    !existingType ? (0, _invariant.default)(0, "Unknown type: \"".concat(typeName, "\".")) : void 0;
    return extendNamedType(existingType);
  });
  var extendTypeCache = Object.create(null);
  var schemaConfig = schema.toConfig(); // Get the extended root operation types.

  var operationTypes = {
    query: extendMaybeNamedType(schemaConfig.query),
    mutation: extendMaybeNamedType(schemaConfig.mutation),
    subscription: extendMaybeNamedType(schemaConfig.subscription)
  };

  if (schemaDef) {
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = schemaDef.operationTypes[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var _ref2 = _step2.value;
        var operation = _ref2.operation;
        var type = _ref2.type;
        // Note: While this could make early assertions to get the correctly
        // typed values, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable results.
        operationTypes[operation] = astBuilder.buildType(type);
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
  } // Then, incorporate schema definition and all schema extensions.


  for (var _i = 0; _i < schemaExtensions.length; _i++) {
    var schemaExtension = schemaExtensions[_i];

    if (schemaExtension.operationTypes) {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = schemaExtension.operationTypes[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var _ref4 = _step3.value;
          var _operation = _ref4.operation;
          var _type = _ref4.type;
          // Note: While this could make early assertions to get the correctly
          // typed values, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable results.
          operationTypes[_operation] = astBuilder.buildType(_type);
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
    }
  }

  var schemaTypes = [].concat(schemaConfig.types.map(function (type) {
    return extendNamedType(type);
  }), (0, _objectValues.default)(typeDefinitionMap).map(function (type) {
    return astBuilder.buildType(type);
  })); // Support both original legacy names and extended legacy names.

  var allowedLegacyNames = schemaConfig.allowedLegacyNames.concat(options && options.allowedLegacyNames || []); // Then produce and return a Schema with these types.

  return new _schema.GraphQLSchema(_objectSpread({}, operationTypes, {
    types: schemaTypes,
    directives: getMergedDirectives(),
    astNode: schemaConfig.astNode,
    extensionASTNodes: schemaConfig.extensionASTNodes.concat(schemaExtensions),
    allowedLegacyNames: allowedLegacyNames
  })); // Below are functions used for producing this schema that have closed over
  // this scope and have access to the schema, cache, and newly defined types.

  function getMergedDirectives() {
    var existingDirectives = schema.getDirectives().map(extendDirective);
    !existingDirectives ? (0, _invariant.default)(0, 'schema must have default directives') : void 0;
    return existingDirectives.concat(directiveDefinitions.map(function (node) {
      return astBuilder.buildDirective(node);
    }));
  }

  function extendMaybeNamedType(type) {
    return type ? extendNamedType(type) : null;
  }

  function extendNamedType(type) {
    if ((0, _introspection.isIntrospectionType)(type) || (0, _scalars.isSpecifiedScalarType)(type)) {
      // Builtin types are not extended.
      return type;
    }

    var name = type.name;

    if (!extendTypeCache[name]) {
      if ((0, _definition.isScalarType)(type)) {
        extendTypeCache[name] = extendScalarType(type);
      } else if ((0, _definition.isObjectType)(type)) {
        extendTypeCache[name] = extendObjectType(type);
      } else if ((0, _definition.isInterfaceType)(type)) {
        extendTypeCache[name] = extendInterfaceType(type);
      } else if ((0, _definition.isUnionType)(type)) {
        extendTypeCache[name] = extendUnionType(type);
      } else if ((0, _definition.isEnumType)(type)) {
        extendTypeCache[name] = extendEnumType(type);
      } else if ((0, _definition.isInputObjectType)(type)) {
        extendTypeCache[name] = extendInputObjectType(type);
      }
    }

    return extendTypeCache[name];
  }

  function extendDirective(directive) {
    var config = directive.toConfig();
    return new _directives.GraphQLDirective(_objectSpread({}, config, {
      args: (0, _mapValue.default)(config.args, extendArg)
    }));
  }

  function extendInputObjectType(type) {
    var config = type.toConfig();
    var extensions = typeExtensionsMap[config.name] || [];
    var fieldNodes = flatMap(extensions, function (node) {
      return node.fields || [];
    });
    return new _definition.GraphQLInputObjectType(_objectSpread({}, config, {
      fields: function fields() {
        return _objectSpread({}, (0, _mapValue.default)(config.fields, function (field) {
          return _objectSpread({}, field, {
            type: extendType(field.type)
          });
        }), (0, _keyValMap.default)(fieldNodes, function (field) {
          return field.name.value;
        }, function (field) {
          return astBuilder.buildInputField(field);
        }));
      },
      extensionASTNodes: config.extensionASTNodes.concat(extensions)
    }));
  }

  function extendEnumType(type) {
    var config = type.toConfig();
    var extensions = typeExtensionsMap[type.name] || [];
    var valueNodes = flatMap(extensions, function (node) {
      return node.values || [];
    });
    return new _definition.GraphQLEnumType(_objectSpread({}, config, {
      values: _objectSpread({}, config.values, (0, _keyValMap.default)(valueNodes, function (value) {
        return value.name.value;
      }, function (value) {
        return astBuilder.buildEnumValue(value);
      })),
      extensionASTNodes: config.extensionASTNodes.concat(extensions)
    }));
  }

  function extendScalarType(type) {
    var config = type.toConfig();
    var extensions = typeExtensionsMap[config.name] || [];
    return new _definition.GraphQLScalarType(_objectSpread({}, config, {
      extensionASTNodes: config.extensionASTNodes.concat(extensions)
    }));
  }

  function extendObjectType(type) {
    var config = type.toConfig();
    var extensions = typeExtensionsMap[config.name] || [];
    var interfaceNodes = flatMap(extensions, function (node) {
      return node.interfaces || [];
    });
    var fieldNodes = flatMap(extensions, function (node) {
      return node.fields || [];
    });
    return new _definition.GraphQLObjectType(_objectSpread({}, config, {
      interfaces: function interfaces() {
        return [].concat(type.getInterfaces().map(extendNamedType), interfaceNodes.map(function (node) {
          return astBuilder.buildType(node);
        }));
      },
      fields: function fields() {
        return _objectSpread({}, (0, _mapValue.default)(config.fields, extendField), (0, _keyValMap.default)(fieldNodes, function (node) {
          return node.name.value;
        }, function (node) {
          return astBuilder.buildField(node);
        }));
      },
      extensionASTNodes: config.extensionASTNodes.concat(extensions)
    }));
  }

  function extendInterfaceType(type) {
    var config = type.toConfig();
    var extensions = typeExtensionsMap[config.name] || [];
    var fieldNodes = flatMap(extensions, function (node) {
      return node.fields || [];
    });
    return new _definition.GraphQLInterfaceType(_objectSpread({}, config, {
      fields: function fields() {
        return _objectSpread({}, (0, _mapValue.default)(config.fields, extendField), (0, _keyValMap.default)(fieldNodes, function (node) {
          return node.name.value;
        }, function (node) {
          return astBuilder.buildField(node);
        }));
      },
      extensionASTNodes: config.extensionASTNodes.concat(extensions)
    }));
  }

  function extendUnionType(type) {
    var config = type.toConfig();
    var extensions = typeExtensionsMap[config.name] || [];
    var typeNodes = flatMap(extensions, function (node) {
      return node.types || [];
    });
    return new _definition.GraphQLUnionType(_objectSpread({}, config, {
      types: function types() {
        return [].concat(type.getTypes().map(extendNamedType), typeNodes.map(function (node) {
          return astBuilder.buildType(node);
        }));
      },
      extensionASTNodes: config.extensionASTNodes.concat(extensions)
    }));
  }

  function extendField(field) {
    return _objectSpread({}, field, {
      type: extendType(field.type),
      args: (0, _mapValue.default)(field.args, extendArg)
    });
  }

  function extendArg(arg) {
    return _objectSpread({}, arg, {
      type: extendType(arg.type)
    });
  }

  function extendType(typeDef) {
    if ((0, _definition.isListType)(typeDef)) {
      return (0, _definition.GraphQLList)(extendType(typeDef.ofType));
    }

    if ((0, _definition.isNonNullType)(typeDef)) {
      return (0, _definition.GraphQLNonNull)(extendType(typeDef.ofType));
    }

    return extendNamedType(typeDef);
  }
}

function flatMap(list, mapFn) {
  var result = [];
  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = list[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var item = _step4.value;
      result = result.concat(mapFn(item));
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

  return result;
}