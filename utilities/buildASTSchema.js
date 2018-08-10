"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildASTSchema = buildASTSchema;
exports.getDescription = getDescription;
exports.buildSchema = buildSchema;
exports.ASTDefinitionBuilder = void 0;

var _invariant = _interopRequireDefault(require("../jsutils/invariant"));

var _keyMap = _interopRequireDefault(require("../jsutils/keyMap"));

var _keyValMap = _interopRequireDefault(require("../jsutils/keyValMap"));

var _valueFromAST = require("./valueFromAST");

var _validate = require("../validation/validate");

var _blockStringValue = _interopRequireDefault(require("../language/blockStringValue"));

var _lexer = require("../language/lexer");

var _parser = require("../language/parser");

var _values = require("../execution/values");

var _kinds = require("../language/kinds");

var _predicates = require("../language/predicates");

var _definition = require("../type/definition");

var _directives = require("../type/directives");

var _introspection = require("../type/introspection");

var _scalars = require("../type/scalars");

var _schema = require("../type/schema");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * This takes the ast of a schema document produced by the parse function in
 * src/language/parser.js.
 *
 * If no schema definition is provided, then it will look for types named Query
 * and Mutation.
 *
 * Given that AST it constructs a GraphQLSchema. The resulting schema
 * has no resolve methods, so execution will use default resolvers.
 *
 * Accepts options as a second argument:
 *
 *    - commentDescriptions:
 *        Provide true to use preceding comments as the description.
 *
 */
function buildASTSchema(documentAST, options) {
  !(documentAST && documentAST.kind === _kinds.Kind.DOCUMENT) ? (0, _invariant.default)(0, 'Must provide valid Document AST') : void 0;

  if (!options || !(options.assumeValid || options.assumeValidSDL)) {
    (0, _validate.assertValidSDL)(documentAST);
  }

  var schemaDef;
  var typeDefs = [];
  var nodeMap = Object.create(null);
  var directiveDefs = [];

  for (var i = 0; i < documentAST.definitions.length; i++) {
    var def = documentAST.definitions[i];

    if (def.kind === _kinds.Kind.SCHEMA_DEFINITION) {
      schemaDef = def;
    } else if ((0, _predicates.isTypeDefinitionNode)(def)) {
      var typeName = def.name.value;

      if (nodeMap[typeName]) {
        throw new Error("Type \"".concat(typeName, "\" was defined more than once."));
      }

      typeDefs.push(def);
      nodeMap[typeName] = def;
    } else if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
      directiveDefs.push(def);
    }
  }

  var operationTypes = schemaDef ? getOperationTypes(schemaDef) : {
    query: nodeMap.Query,
    mutation: nodeMap.Mutation,
    subscription: nodeMap.Subscription
  };
  var definitionBuilder = new ASTDefinitionBuilder(nodeMap, options, function (typeRef) {
    throw new Error("Type \"".concat(typeRef.name.value, "\" not found in document."));
  });
  var directives = directiveDefs.map(function (def) {
    return definitionBuilder.buildDirective(def);
  }); // If specified directives were not explicitly declared, add them.

  if (!directives.some(function (directive) {
    return directive.name === 'skip';
  })) {
    directives.push(_directives.GraphQLSkipDirective);
  }

  if (!directives.some(function (directive) {
    return directive.name === 'include';
  })) {
    directives.push(_directives.GraphQLIncludeDirective);
  }

  if (!directives.some(function (directive) {
    return directive.name === 'deprecated';
  })) {
    directives.push(_directives.GraphQLDeprecatedDirective);
  } // Note: While this could make early assertions to get the correctly
  // typed values below, that would throw immediately while type system
  // validation with validateSchema() will produce more actionable results.


  return new _schema.GraphQLSchema({
    query: operationTypes.query ? definitionBuilder.buildType(operationTypes.query) : null,
    mutation: operationTypes.mutation ? definitionBuilder.buildType(operationTypes.mutation) : null,
    subscription: operationTypes.subscription ? definitionBuilder.buildType(operationTypes.subscription) : null,
    types: typeDefs.map(function (node) {
      return definitionBuilder.buildType(node);
    }),
    directives: directives,
    astNode: schemaDef,
    assumeValid: options && options.assumeValid,
    allowedLegacyNames: options && options.allowedLegacyNames
  });

  function getOperationTypes(schema) {
    var opTypes = {};
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = schema.operationTypes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var operationType = _step.value;
        var _typeName = operationType.type.name.value;
        var operation = operationType.operation;

        if (opTypes[operation]) {
          throw new Error("Must provide only one ".concat(operation, " type in schema."));
        }

        if (!nodeMap[_typeName]) {
          throw new Error("Specified ".concat(operation, " type \"").concat(_typeName, "\" not found in document."));
        }

        opTypes[operation] = operationType.type;
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

    return opTypes;
  }
}

var ASTDefinitionBuilder =
/*#__PURE__*/
function () {
  function ASTDefinitionBuilder(typeDefinitionsMap, options, resolveType) {
    _defineProperty(this, "_typeDefinitionsMap", void 0);

    _defineProperty(this, "_options", void 0);

    _defineProperty(this, "_resolveType", void 0);

    _defineProperty(this, "_cache", void 0);

    this._typeDefinitionsMap = typeDefinitionsMap;
    this._options = options;
    this._resolveType = resolveType; // Initialize to the GraphQL built in scalars and introspection types.

    this._cache = (0, _keyMap.default)(_scalars.specifiedScalarTypes.concat(_introspection.introspectionTypes), function (type) {
      return type.name;
    });
  }

  var _proto = ASTDefinitionBuilder.prototype;

  _proto.buildType = function buildType(node) {
    var typeName = node.name.value;

    if (!this._cache[typeName]) {
      if (node.kind === _kinds.Kind.NAMED_TYPE) {
        var defNode = this._typeDefinitionsMap[typeName];
        this._cache[typeName] = defNode ? this._makeSchemaDef(defNode) : this._resolveType(node);
      } else {
        this._cache[typeName] = this._makeSchemaDef(node);
      }
    }

    return this._cache[typeName];
  };

  _proto._buildWrappedType = function _buildWrappedType(typeNode) {
    if (typeNode.kind === _kinds.Kind.LIST_TYPE) {
      return (0, _definition.GraphQLList)(this._buildWrappedType(typeNode.type));
    }

    if (typeNode.kind === _kinds.Kind.NON_NULL_TYPE) {
      return (0, _definition.GraphQLNonNull)( // Note: GraphQLNonNull constructor validates this type
      this._buildWrappedType(typeNode.type));
    }

    return this.buildType(typeNode);
  };

  _proto.buildDirective = function buildDirective(directiveNode) {
    return new _directives.GraphQLDirective({
      name: directiveNode.name.value,
      description: getDescription(directiveNode, this._options),
      locations: directiveNode.locations.map(function (node) {
        return node.value;
      }),
      args: directiveNode.arguments && this._makeInputValues(directiveNode.arguments),
      astNode: directiveNode
    });
  };

  _proto.buildField = function buildField(field) {
    return {
      // Note: While this could make assertions to get the correctly typed
      // value, that would throw immediately while type system validation
      // with validateSchema() will produce more actionable results.
      type: this._buildWrappedType(field.type),
      description: getDescription(field, this._options),
      args: field.arguments && this._makeInputValues(field.arguments),
      deprecationReason: getDeprecationReason(field),
      astNode: field
    };
  };

  _proto.buildInputField = function buildInputField(value) {
    // Note: While this could make assertions to get the correctly typed
    // value, that would throw immediately while type system validation
    var type = this._buildWrappedType(value.type);

    return {
      name: value.name.value,
      type: type,
      description: getDescription(value, this._options),
      defaultValue: (0, _valueFromAST.valueFromAST)(value.defaultValue, type),
      astNode: value
    };
  };

  _proto.buildEnumValue = function buildEnumValue(value) {
    return {
      description: getDescription(value, this._options),
      deprecationReason: getDeprecationReason(value),
      astNode: value
    };
  };

  _proto._makeSchemaDef = function _makeSchemaDef(def) {
    switch (def.kind) {
      case _kinds.Kind.OBJECT_TYPE_DEFINITION:
        return this._makeTypeDef(def);

      case _kinds.Kind.INTERFACE_TYPE_DEFINITION:
        return this._makeInterfaceDef(def);

      case _kinds.Kind.ENUM_TYPE_DEFINITION:
        return this._makeEnumDef(def);

      case _kinds.Kind.UNION_TYPE_DEFINITION:
        return this._makeUnionDef(def);

      case _kinds.Kind.SCALAR_TYPE_DEFINITION:
        return this._makeScalarDef(def);

      case _kinds.Kind.INPUT_OBJECT_TYPE_DEFINITION:
        return this._makeInputObjectDef(def);

      default:
        throw new Error("Type kind \"".concat(def.kind, "\" not supported."));
    }
  };

  _proto._makeTypeDef = function _makeTypeDef(def) {
    var _this = this;

    var interfaces = def.interfaces;
    return new _definition.GraphQLObjectType({
      name: def.name.value,
      description: getDescription(def, this._options),
      fields: function fields() {
        return _this._makeFieldDefMap(def);
      },
      // Note: While this could make early assertions to get the correctly
      // typed values, that would throw immediately while type system
      // validation with validateSchema() will produce more actionable results.
      interfaces: interfaces ? function () {
        return interfaces.map(function (ref) {
          return _this.buildType(ref);
        });
      } : [],
      astNode: def
    });
  };

  _proto._makeFieldDefMap = function _makeFieldDefMap(def) {
    var _this2 = this;

    return def.fields ? (0, _keyValMap.default)(def.fields, function (field) {
      return field.name.value;
    }, function (field) {
      return _this2.buildField(field);
    }) : {};
  };

  _proto._makeInputValues = function _makeInputValues(values) {
    var _this3 = this;

    return (0, _keyValMap.default)(values, function (value) {
      return value.name.value;
    }, function (value) {
      return _this3.buildInputField(value);
    });
  };

  _proto._makeInterfaceDef = function _makeInterfaceDef(def) {
    var _this4 = this;

    return new _definition.GraphQLInterfaceType({
      name: def.name.value,
      description: getDescription(def, this._options),
      fields: function fields() {
        return _this4._makeFieldDefMap(def);
      },
      astNode: def
    });
  };

  _proto._makeEnumDef = function _makeEnumDef(def) {
    return new _definition.GraphQLEnumType({
      name: def.name.value,
      description: getDescription(def, this._options),
      values: this._makeValueDefMap(def),
      astNode: def
    });
  };

  _proto._makeValueDefMap = function _makeValueDefMap(def) {
    var _this5 = this;

    return def.values ? (0, _keyValMap.default)(def.values, function (enumValue) {
      return enumValue.name.value;
    }, function (enumValue) {
      return _this5.buildEnumValue(enumValue);
    }) : {};
  };

  _proto._makeUnionDef = function _makeUnionDef(def) {
    var _this6 = this;

    var types = def.types;
    return new _definition.GraphQLUnionType({
      name: def.name.value,
      description: getDescription(def, this._options),
      // Note: While this could make assertions to get the correctly typed
      // values below, that would throw immediately while type system
      // validation with validateSchema() will produce more actionable results.
      types: types ? function () {
        return types.map(function (ref) {
          return _this6.buildType(ref);
        });
      } : [],
      astNode: def
    });
  };

  _proto._makeScalarDef = function _makeScalarDef(def) {
    return new _definition.GraphQLScalarType({
      name: def.name.value,
      description: getDescription(def, this._options),
      astNode: def,
      serialize: function serialize(value) {
        return value;
      }
    });
  };

  _proto._makeInputObjectDef = function _makeInputObjectDef(def) {
    var _this7 = this;

    return new _definition.GraphQLInputObjectType({
      name: def.name.value,
      description: getDescription(def, this._options),
      fields: function fields() {
        return def.fields ? _this7._makeInputValues(def.fields) : {};
      },
      astNode: def
    });
  };

  return ASTDefinitionBuilder;
}();
/**
 * Given a field or enum value node, returns the string value for the
 * deprecation reason.
 */


exports.ASTDefinitionBuilder = ASTDefinitionBuilder;

function getDeprecationReason(node) {
  var deprecated = (0, _values.getDirectiveValues)(_directives.GraphQLDeprecatedDirective, node);
  return deprecated && deprecated.reason;
}
/**
 * Given an ast node, returns its string description.
 * @deprecated: provided to ease adoption and will be removed in v16.
 *
 * Accepts options as a second argument:
 *
 *    - commentDescriptions:
 *        Provide true to use preceding comments as the description.
 *
 */


function getDescription(node, options) {
  if (node.description) {
    return node.description.value;
  }

  if (options && options.commentDescriptions) {
    var rawValue = getLeadingCommentBlock(node);

    if (rawValue !== undefined) {
      return (0, _blockStringValue.default)('\n' + rawValue);
    }
  }
}

function getLeadingCommentBlock(node) {
  var loc = node.loc;

  if (!loc) {
    return;
  }

  var comments = [];
  var token = loc.startToken.prev;

  while (token && token.kind === _lexer.TokenKind.COMMENT && token.next && token.prev && token.line + 1 === token.next.line && token.line !== token.prev.line) {
    var value = String(token.value);
    comments.push(value);
    token = token.prev;
  }

  return comments.reverse().join('\n');
}
/**
 * A helper function to build a GraphQLSchema directly from a source
 * document.
 */


function buildSchema(source, options) {
  return buildASTSchema((0, _parser.parse)(source, options), options);
}