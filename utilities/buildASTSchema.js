"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildASTSchema = buildASTSchema;
exports.getDescription = getDescription;
exports.buildSchema = buildSchema;
exports.ASTDefinitionBuilder = void 0;

var _objectValues = _interopRequireDefault(require("../polyfills/objectValues"));

var _keyMap = _interopRequireDefault(require("../jsutils/keyMap"));

var _inspect = _interopRequireDefault(require("../jsutils/inspect"));

var _invariant = _interopRequireDefault(require("../jsutils/invariant"));

var _devAssert = _interopRequireDefault(require("../jsutils/devAssert"));

var _kinds = require("../language/kinds");

var _tokenKind = require("../language/tokenKind");

var _parser = require("../language/parser");

var _predicates = require("../language/predicates");

var _blockString = require("../language/blockString");

var _validate = require("../validation/validate");

var _values = require("../execution/values");

var _scalars = require("../type/scalars");

var _introspection = require("../type/introspection");

var _schema = require("../type/schema");

var _directives = require("../type/directives");

var _definition = require("../type/definition");

var _valueFromAST = require("./valueFromAST");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

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
  documentAST && documentAST.kind === _kinds.Kind.DOCUMENT || (0, _devAssert.default)(0, 'Must provide valid Document AST');

  if (!options || !(options.assumeValid || options.assumeValidSDL)) {
    (0, _validate.assertValidSDL)(documentAST);
  }

  var schemaDef;
  var typeDefs = [];
  var directiveDefs = [];

  for (var _i2 = 0, _documentAST$definiti2 = documentAST.definitions; _i2 < _documentAST$definiti2.length; _i2++) {
    var def = _documentAST$definiti2[_i2];

    if (def.kind === _kinds.Kind.SCHEMA_DEFINITION) {
      schemaDef = def;
    } else if ((0, _predicates.isTypeDefinitionNode)(def)) {
      typeDefs.push(def);
    } else if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
      directiveDefs.push(def);
    }
  }

  var astBuilder = new ASTDefinitionBuilder(options, function (typeName) {
    var type = typeMap[typeName];

    if (type === undefined) {
      throw new Error("Type \"".concat(typeName, "\" not found in document."));
    }

    return type;
  });
  var typeMap = astBuilder.buildTypeMap(typeDefs);
  var operationTypes = schemaDef ? astBuilder.getOperationTypes([schemaDef]) : {
    // Note: While this could make early assertions to get the correctly
    // typed values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    query: typeMap['Query'],
    mutation: typeMap['Mutation'],
    subscription: typeMap['Subscription']
  };
  var directives = directiveDefs.map(function (def) {
    return astBuilder.buildDirective(def);
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
  }

  return new _schema.GraphQLSchema(_objectSpread({}, operationTypes, {
    types: (0, _objectValues.default)(typeMap),
    directives: directives,
    astNode: schemaDef,
    assumeValid: options && options.assumeValid
  }));
}

var stdTypeMap = (0, _keyMap.default)(_scalars.specifiedScalarTypes.concat(_introspection.introspectionTypes), function (type) {
  return type.name;
});

var ASTDefinitionBuilder =
/*#__PURE__*/
function () {
  function ASTDefinitionBuilder(options, resolveType) {
    this._options = options;
    this._resolveType = resolveType;
  }

  var _proto = ASTDefinitionBuilder.prototype;

  _proto.getOperationTypes = function getOperationTypes(nodes) {
    // Note: While this could make early assertions to get the correctly
    // typed values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    var opTypes = {};

    for (var _i4 = 0; _i4 < nodes.length; _i4++) {
      var node = nodes[_i4];

      if (node.operationTypes != null) {
        for (var _i6 = 0, _node$operationTypes2 = node.operationTypes; _i6 < _node$operationTypes2.length; _i6++) {
          var operationType = _node$operationTypes2[_i6];
          var _typeName = operationType.type.name.value;
          opTypes[operationType.operation] = this._resolveType(_typeName);
        }
      }
    }

    return opTypes;
  };

  _proto.getNamedType = function getNamedType(node) {
    var name = node.name.value;
    return stdTypeMap[name] || this._resolveType(name);
  };

  _proto.getWrappedType = function getWrappedType(node) {
    if (node.kind === _kinds.Kind.LIST_TYPE) {
      return new _definition.GraphQLList(this.getWrappedType(node.type));
    }

    if (node.kind === _kinds.Kind.NON_NULL_TYPE) {
      return new _definition.GraphQLNonNull(this.getWrappedType(node.type));
    }

    return this.getNamedType(node);
  };

  _proto.buildDirective = function buildDirective(directive) {
    var locations = directive.locations.map(function (_ref) {
      var value = _ref.value;
      return value;
    });
    return new _directives.GraphQLDirective({
      name: directive.name.value,
      description: getDescription(directive, this._options),
      locations: locations,
      isRepeatable: directive.repeatable,
      args: this.buildArgumentMap(directive.arguments),
      astNode: directive
    });
  };

  _proto.buildFieldMap = function buildFieldMap(nodes) {
    var fieldConfigMap = Object.create(null);

    for (var _i8 = 0; _i8 < nodes.length; _i8++) {
      var node = nodes[_i8];

      if (node.fields != null) {
        for (var _i10 = 0, _node$fields2 = node.fields; _i10 < _node$fields2.length; _i10++) {
          var field = _node$fields2[_i10];
          fieldConfigMap[field.name.value] = {
            // Note: While this could make assertions to get the correctly typed
            // value, that would throw immediately while type system validation
            // with validateSchema() will produce more actionable results.
            type: this.getWrappedType(field.type),
            description: getDescription(field, this._options),
            args: this.buildArgumentMap(field.arguments),
            deprecationReason: getDeprecationReason(field),
            astNode: field
          };
        }
      }
    }

    return fieldConfigMap;
  };

  _proto.buildArgumentMap = function buildArgumentMap(args) {
    var argConfigMap = Object.create(null);

    if (args != null) {
      for (var _i12 = 0; _i12 < args.length; _i12++) {
        var arg = args[_i12];
        // Note: While this could make assertions to get the correctly typed
        // value, that would throw immediately while type system validation
        // with validateSchema() will produce more actionable results.
        var type = this.getWrappedType(arg.type);
        argConfigMap[arg.name.value] = {
          type: type,
          description: getDescription(arg, this._options),
          defaultValue: (0, _valueFromAST.valueFromAST)(arg.defaultValue, type),
          astNode: arg
        };
      }
    }

    return argConfigMap;
  };

  _proto.buildInputFieldMap = function buildInputFieldMap(nodes) {
    var inputFieldMap = Object.create(null);

    for (var _i14 = 0; _i14 < nodes.length; _i14++) {
      var node = nodes[_i14];

      if (node.fields != null) {
        for (var _i16 = 0, _node$fields4 = node.fields; _i16 < _node$fields4.length; _i16++) {
          var field = _node$fields4[_i16];
          // Note: While this could make assertions to get the correctly typed
          // value, that would throw immediately while type system validation
          // with validateSchema() will produce more actionable results.
          var type = this.getWrappedType(field.type);
          inputFieldMap[field.name.value] = {
            type: type,
            description: getDescription(field, this._options),
            defaultValue: (0, _valueFromAST.valueFromAST)(field.defaultValue, type),
            astNode: field
          };
        }
      }
    }

    return inputFieldMap;
  };

  _proto.buildEnumValueMap = function buildEnumValueMap(nodes) {
    var enumValueMap = Object.create(null);

    for (var _i18 = 0; _i18 < nodes.length; _i18++) {
      var node = nodes[_i18];

      if (node.values != null) {
        for (var _i20 = 0, _node$values2 = node.values; _i20 < _node$values2.length; _i20++) {
          var value = _node$values2[_i20];
          enumValueMap[value.name.value] = {
            description: getDescription(value, this._options),
            deprecationReason: getDeprecationReason(value),
            astNode: value
          };
        }
      }
    }

    return enumValueMap;
  };

  _proto.buildInterfaces = function buildInterfaces(nodes) {
    var interfaces = [];

    for (var _i22 = 0; _i22 < nodes.length; _i22++) {
      var node = nodes[_i22];

      if (node.interfaces != null) {
        for (var _i24 = 0, _node$interfaces2 = node.interfaces; _i24 < _node$interfaces2.length; _i24++) {
          var type = _node$interfaces2[_i24];
          // Note: While this could make assertions to get the correctly typed
          // values below, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable
          // results.
          interfaces.push(this.getNamedType(type));
        }
      }
    }

    return interfaces;
  };

  _proto.buildUnionTypes = function buildUnionTypes(nodes) {
    var types = [];

    for (var _i26 = 0; _i26 < nodes.length; _i26++) {
      var node = nodes[_i26];

      if (node.types != null) {
        for (var _i28 = 0, _node$types2 = node.types; _i28 < _node$types2.length; _i28++) {
          var type = _node$types2[_i28];
          // Note: While this could make assertions to get the correctly typed
          // values below, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable
          // results.
          types.push(this.getNamedType(type));
        }
      }
    }

    return types;
  };

  _proto.buildTypeMap = function buildTypeMap(nodes) {
    var typeMap = Object.create(null);

    for (var _i30 = 0; _i30 < nodes.length; _i30++) {
      var node = nodes[_i30];
      var name = node.name.value;
      typeMap[name] = stdTypeMap[name] || this._buildType(node);
    }

    return typeMap;
  };

  _proto._buildType = function _buildType(astNode) {
    var _this = this;

    var name = astNode.name.value;
    var description = getDescription(astNode, this._options);

    switch (astNode.kind) {
      case _kinds.Kind.OBJECT_TYPE_DEFINITION:
        return new _definition.GraphQLObjectType({
          name: name,
          description: description,
          interfaces: function interfaces() {
            return _this.buildInterfaces([astNode]);
          },
          fields: function fields() {
            return _this.buildFieldMap([astNode]);
          },
          astNode: astNode
        });

      case _kinds.Kind.INTERFACE_TYPE_DEFINITION:
        return new _definition.GraphQLInterfaceType({
          name: name,
          description: description,
          interfaces: function interfaces() {
            return _this.buildInterfaces([astNode]);
          },
          fields: function fields() {
            return _this.buildFieldMap([astNode]);
          },
          astNode: astNode
        });

      case _kinds.Kind.ENUM_TYPE_DEFINITION:
        return new _definition.GraphQLEnumType({
          name: name,
          description: description,
          values: this.buildEnumValueMap([astNode]),
          astNode: astNode
        });

      case _kinds.Kind.UNION_TYPE_DEFINITION:
        return new _definition.GraphQLUnionType({
          name: name,
          description: description,
          types: function types() {
            return _this.buildUnionTypes([astNode]);
          },
          astNode: astNode
        });

      case _kinds.Kind.SCALAR_TYPE_DEFINITION:
        return new _definition.GraphQLScalarType({
          name: name,
          description: description,
          astNode: astNode
        });

      case _kinds.Kind.INPUT_OBJECT_TYPE_DEFINITION:
        return new _definition.GraphQLInputObjectType({
          name: name,
          description: description,
          fields: function fields() {
            return _this.buildInputFieldMap([astNode]);
          },
          astNode: astNode
        });
    } // Not reachable. All possible type definition nodes have been considered.


    /* istanbul ignore next */
    (0, _invariant.default)(false, 'Unexpected type definition node: ' + (0, _inspect.default)(astNode));
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
      return (0, _blockString.dedentBlockStringValue)('\n' + rawValue);
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

  while (token && token.kind === _tokenKind.TokenKind.COMMENT && token.next && token.prev && token.line + 1 === token.next.line && token.line !== token.prev.line) {
    var value = String(token.value);
    comments.push(value);
    token = token.prev;
  }

  return comments.length > 0 ? comments.reverse().join('\n') : undefined;
}
/**
 * A helper function to build a GraphQLSchema directly from a source
 * document.
 */


function buildSchema(source, options) {
  return buildASTSchema((0, _parser.parse)(source, options), options);
}
