function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

import objectValues from '../polyfills/objectValues';
import keyMap from '../jsutils/keyMap';
import inspect from '../jsutils/inspect';
import invariant from '../jsutils/invariant';
import devAssert from '../jsutils/devAssert';
import { Kind } from '../language/kinds';
import { TokenKind } from '../language/tokenKind';
import { parse } from '../language/parser';
import { isTypeDefinitionNode } from '../language/predicates';
import { dedentBlockStringValue } from '../language/blockString';
import { assertValidSDL } from '../validation/validate';
import { getDirectiveValues } from '../execution/values';
import { specifiedScalarTypes } from '../type/scalars';
import { introspectionTypes } from '../type/introspection';
import { GraphQLSchema } from '../type/schema';
import { GraphQLDirective, GraphQLSkipDirective, GraphQLIncludeDirective, GraphQLDeprecatedDirective } from '../type/directives';
import { GraphQLScalarType, GraphQLObjectType, GraphQLInterfaceType, GraphQLUnionType, GraphQLEnumType, GraphQLInputObjectType, GraphQLList, GraphQLNonNull } from '../type/definition';
import { valueFromAST } from './valueFromAST';

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
export function buildASTSchema(documentAST, options) {
  documentAST && documentAST.kind === Kind.DOCUMENT || devAssert(0, 'Must provide valid Document AST.');

  if (!options || !(options.assumeValid || options.assumeValidSDL)) {
    assertValidSDL(documentAST);
  }

  var schemaDef;
  var typeDefs = [];
  var directiveDefs = [];

  for (var _i2 = 0, _documentAST$definiti2 = documentAST.definitions; _i2 < _documentAST$definiti2.length; _i2++) {
    var def = _documentAST$definiti2[_i2];

    if (def.kind === Kind.SCHEMA_DEFINITION) {
      schemaDef = def;
    } else if (isTypeDefinitionNode(def)) {
      typeDefs.push(def);
    } else if (def.kind === Kind.DIRECTIVE_DEFINITION) {
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
  var directives = astBuilder.buildDirectives(directiveDefs); // If specified directives were not explicitly declared, add them.

  if (!directives.some(function (directive) {
    return directive.name === 'skip';
  })) {
    directives.push(GraphQLSkipDirective);
  }

  if (!directives.some(function (directive) {
    return directive.name === 'include';
  })) {
    directives.push(GraphQLIncludeDirective);
  }

  if (!directives.some(function (directive) {
    return directive.name === 'deprecated';
  })) {
    directives.push(GraphQLDeprecatedDirective);
  }

  return new GraphQLSchema(_objectSpread({}, operationTypes, {
    types: objectValues(typeMap),
    directives: directives,
    astNode: schemaDef,
    assumeValid: options && options.assumeValid
  }));
}
var stdTypeMap = keyMap(specifiedScalarTypes.concat(introspectionTypes), function (type) {
  return type.name;
});
export var ASTDefinitionBuilder =
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
    if (node.kind === Kind.LIST_TYPE) {
      return new GraphQLList(this.getWrappedType(node.type));
    }

    if (node.kind === Kind.NON_NULL_TYPE) {
      return new GraphQLNonNull(this.getWrappedType(node.type));
    }

    return this.getNamedType(node);
  };

  _proto.buildDirectives = function buildDirectives(nodes) {
    var _this = this;

    return nodes.map(function (directive) {
      var locations = directive.locations.map(function (_ref) {
        var value = _ref.value;
        return value;
      });
      return new GraphQLDirective({
        name: directive.name.value,
        description: getDescription(directive, _this._options),
        locations: locations,
        isRepeatable: directive.repeatable,
        args: _this.buildArgumentMap(directive.arguments),
        astNode: directive
      });
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
          defaultValue: valueFromAST(arg.defaultValue, type),
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
            defaultValue: valueFromAST(field.defaultValue, type),
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
    var _this2 = this;

    var name = astNode.name.value;
    var description = getDescription(astNode, this._options);

    switch (astNode.kind) {
      case Kind.OBJECT_TYPE_DEFINITION:
        return new GraphQLObjectType({
          name: name,
          description: description,
          interfaces: function interfaces() {
            return _this2.buildInterfaces([astNode]);
          },
          fields: function fields() {
            return _this2.buildFieldMap([astNode]);
          },
          astNode: astNode
        });

      case Kind.INTERFACE_TYPE_DEFINITION:
        return new GraphQLInterfaceType({
          name: name,
          description: description,
          interfaces: function interfaces() {
            return _this2.buildInterfaces([astNode]);
          },
          fields: function fields() {
            return _this2.buildFieldMap([astNode]);
          },
          astNode: astNode
        });

      case Kind.ENUM_TYPE_DEFINITION:
        return new GraphQLEnumType({
          name: name,
          description: description,
          values: this.buildEnumValueMap([astNode]),
          astNode: astNode
        });

      case Kind.UNION_TYPE_DEFINITION:
        return new GraphQLUnionType({
          name: name,
          description: description,
          types: function types() {
            return _this2.buildUnionTypes([astNode]);
          },
          astNode: astNode
        });

      case Kind.SCALAR_TYPE_DEFINITION:
        return new GraphQLScalarType({
          name: name,
          description: description,
          astNode: astNode
        });

      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        return new GraphQLInputObjectType({
          name: name,
          description: description,
          fields: function fields() {
            return _this2.buildInputFieldMap([astNode]);
          },
          astNode: astNode
        });
    } // Not reachable. All possible type definition nodes have been considered.


    /* istanbul ignore next */
    invariant(false, 'Unexpected type definition node: ' + inspect(astNode));
  };

  return ASTDefinitionBuilder;
}();
/**
 * Given a field or enum value node, returns the string value for the
 * deprecation reason.
 */

function getDeprecationReason(node) {
  var deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
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


export function getDescription(node, options) {
  if (node.description) {
    return node.description.value;
  }

  if (options && options.commentDescriptions) {
    var rawValue = getLeadingCommentBlock(node);

    if (rawValue !== undefined) {
      return dedentBlockStringValue('\n' + rawValue);
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

  while (token && token.kind === TokenKind.COMMENT && token.next && token.prev && token.line + 1 === token.next.line && token.line !== token.prev.line) {
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


export function buildSchema(source, options) {
  var document = parse(source, {
    noLocation: options && options.noLocation || false,
    allowLegacySDLEmptyFields: options && options.allowLegacySDLEmptyFields || false,
    allowLegacySDLImplementsInterfaces: options && options.allowLegacySDLImplementsInterfaces || false,
    experimentalFragmentVariables: options && options.experimentalFragmentVariables || false
  });
  return buildASTSchema(document, {
    commentDescriptions: options && options.commentDescriptions || false,
    assumeValidSDL: options && options.assumeValidSDL || false,
    assumeValid: options && options.assumeValid || false
  });
}
