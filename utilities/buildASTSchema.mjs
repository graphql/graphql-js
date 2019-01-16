/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
import objectValues from '../polyfills/objectValues';
import invariant from '../jsutils/invariant';
import keyMap from '../jsutils/keyMap';
import keyValMap from '../jsutils/keyValMap';
import { valueFromAST } from './valueFromAST';
import { assertValidSDL } from '../validation/validate';
import blockStringValue from '../language/blockStringValue';
import { TokenKind } from '../language/lexer';
import { parse } from '../language/parser';
import { getDirectiveValues } from '../execution/values';
import { Kind } from '../language/kinds';
import { isTypeDefinitionNode } from '../language/predicates';
import { GraphQLScalarType, GraphQLObjectType, GraphQLInterfaceType, GraphQLUnionType, GraphQLEnumType, GraphQLInputObjectType, GraphQLList, GraphQLNonNull } from '../type/definition';
import { GraphQLDirective, GraphQLSkipDirective, GraphQLIncludeDirective, GraphQLDeprecatedDirective } from '../type/directives';
import { introspectionTypes } from '../type/introspection';
import { specifiedScalarTypes } from '../type/scalars';
import { GraphQLSchema } from '../type/schema';

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
  !(documentAST && documentAST.kind === Kind.DOCUMENT) ? invariant(0, 'Must provide valid Document AST') : void 0;

  if (!options || !(options.assumeValid || options.assumeValidSDL)) {
    assertValidSDL(documentAST);
  }

  var schemaDef;
  var nodeMap = Object.create(null);
  var directiveDefs = [];
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = documentAST.definitions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var def = _step.value;

      if (def.kind === Kind.SCHEMA_DEFINITION) {
        schemaDef = def;
      } else if (isTypeDefinitionNode(def)) {
        nodeMap[def.name.value] = def;
      } else if (def.kind === Kind.DIRECTIVE_DEFINITION) {
        directiveDefs.push(def);
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

  var operationTypes = schemaDef ? getOperationTypes(schemaDef) : {
    query: nodeMap.Query,
    mutation: nodeMap.Mutation,
    subscription: nodeMap.Subscription
  };
  var definitionBuilder = new ASTDefinitionBuilder(nodeMap, options, function (typeName) {
    throw new Error("Type \"".concat(typeName, "\" not found in document."));
  });
  var directives = directiveDefs.map(function (def) {
    return definitionBuilder.buildDirective(def);
  }); // If specified directives were not explicitly declared, add them.

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
  } // Note: While this could make early assertions to get the correctly
  // typed values below, that would throw immediately while type system
  // validation with validateSchema() will produce more actionable results.


  return new GraphQLSchema({
    query: operationTypes.query ? definitionBuilder.buildType(operationTypes.query) : null,
    mutation: operationTypes.mutation ? definitionBuilder.buildType(operationTypes.mutation) : null,
    subscription: operationTypes.subscription ? definitionBuilder.buildType(operationTypes.subscription) : null,
    types: objectValues(nodeMap).map(function (node) {
      return definitionBuilder.buildType(node);
    }),
    directives: directives,
    astNode: schemaDef,
    assumeValid: options && options.assumeValid,
    allowedLegacyNames: options && options.allowedLegacyNames
  });

  function getOperationTypes(schema) {
    var opTypes = {};
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = schema.operationTypes[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var operationType = _step2.value;
        opTypes[operationType.operation] = operationType.type;
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

    return opTypes;
  }
}
export var ASTDefinitionBuilder =
/*#__PURE__*/
function () {
  function ASTDefinitionBuilder(typeDefinitionsMap, options, resolveType) {
    this._typeDefinitionsMap = typeDefinitionsMap;
    this._options = options;
    this._resolveType = resolveType; // Initialize to the GraphQL built in scalars and introspection types.

    this._cache = keyMap(specifiedScalarTypes.concat(introspectionTypes), function (type) {
      return type.name;
    });
  }

  var _proto = ASTDefinitionBuilder.prototype;

  _proto.buildType = function buildType(node) {
    var typeName = node.name.value;

    if (!this._cache[typeName]) {
      if (node.kind === Kind.NAMED_TYPE) {
        var defNode = this._typeDefinitionsMap[typeName];
        this._cache[typeName] = defNode ? this._makeSchemaDef(defNode) : this._resolveType(node.name.value);
      } else {
        this._cache[typeName] = this._makeSchemaDef(node);
      }
    }

    return this._cache[typeName];
  };

  _proto._buildWrappedType = function _buildWrappedType(typeNode) {
    if (typeNode.kind === Kind.LIST_TYPE) {
      return GraphQLList(this._buildWrappedType(typeNode.type));
    }

    if (typeNode.kind === Kind.NON_NULL_TYPE) {
      return GraphQLNonNull( // Note: GraphQLNonNull constructor validates this type
      this._buildWrappedType(typeNode.type));
    }

    return this.buildType(typeNode);
  };

  _proto.buildDirective = function buildDirective(directive) {
    var _this = this;

    var locations = directive.locations.map(function (_ref) {
      var value = _ref.value;
      return value;
    });
    return new GraphQLDirective({
      name: directive.name.value,
      description: getDescription(directive, this._options),
      locations: locations,
      args: keyByNameNode(directive.arguments || [], function (arg) {
        return _this.buildArg(arg);
      }),
      astNode: directive
    });
  };

  _proto.buildField = function buildField(field) {
    var _this2 = this;

    return {
      // Note: While this could make assertions to get the correctly typed
      // value, that would throw immediately while type system validation
      // with validateSchema() will produce more actionable results.
      type: this._buildWrappedType(field.type),
      description: getDescription(field, this._options),
      args: keyByNameNode(field.arguments || [], function (arg) {
        return _this2.buildArg(arg);
      }),
      deprecationReason: getDeprecationReason(field),
      astNode: field
    };
  };

  _proto.buildArg = function buildArg(value) {
    // Note: While this could make assertions to get the correctly typed
    // value, that would throw immediately while type system validation
    var type = this._buildWrappedType(value.type);

    return {
      type: type,
      description: getDescription(value, this._options),
      defaultValue: valueFromAST(value.defaultValue, type),
      astNode: value
    };
  };

  _proto.buildInputField = function buildInputField(value) {
    // Note: While this could make assertions to get the correctly typed
    // value, that would throw immediately while type system validation
    var type = this._buildWrappedType(value.type);

    return {
      type: type,
      description: getDescription(value, this._options),
      defaultValue: valueFromAST(value.defaultValue, type),
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

  _proto._makeSchemaDef = function _makeSchemaDef(astNode) {
    switch (astNode.kind) {
      case Kind.OBJECT_TYPE_DEFINITION:
        return this._makeTypeDef(astNode);

      case Kind.INTERFACE_TYPE_DEFINITION:
        return this._makeInterfaceDef(astNode);

      case Kind.ENUM_TYPE_DEFINITION:
        return this._makeEnumDef(astNode);

      case Kind.UNION_TYPE_DEFINITION:
        return this._makeUnionDef(astNode);

      case Kind.SCALAR_TYPE_DEFINITION:
        return this._makeScalarDef(astNode);

      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        return this._makeInputObjectDef(astNode);

      default:
        throw new Error("Type kind \"".concat(astNode.kind, "\" not supported."));
    }
  };

  _proto._makeTypeDef = function _makeTypeDef(astNode) {
    var _this3 = this;

    var interfaceNodes = astNode.interfaces;
    var fieldNodes = astNode.fields; // Note: While this could make assertions to get the correctly typed
    // values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.

    var interfaces = interfaceNodes && interfaceNodes.length > 0 ? function () {
      return interfaceNodes.map(function (ref) {
        return _this3.buildType(ref);
      });
    } : [];
    var fields = fieldNodes && fieldNodes.length > 0 ? function () {
      return keyByNameNode(fieldNodes, function (field) {
        return _this3.buildField(field);
      });
    } : Object.create(null);
    return new GraphQLObjectType({
      name: astNode.name.value,
      description: getDescription(astNode, this._options),
      interfaces: interfaces,
      fields: fields,
      astNode: astNode
    });
  };

  _proto._makeInterfaceDef = function _makeInterfaceDef(astNode) {
    var _this4 = this;

    var fieldNodes = astNode.fields;
    var fields = fieldNodes && fieldNodes.length > 0 ? function () {
      return keyByNameNode(fieldNodes, function (field) {
        return _this4.buildField(field);
      });
    } : Object.create(null);
    return new GraphQLInterfaceType({
      name: astNode.name.value,
      description: getDescription(astNode, this._options),
      fields: fields,
      astNode: astNode
    });
  };

  _proto._makeEnumDef = function _makeEnumDef(astNode) {
    var _this5 = this;

    var valueNodes = astNode.values || [];
    return new GraphQLEnumType({
      name: astNode.name.value,
      description: getDescription(astNode, this._options),
      values: keyByNameNode(valueNodes, function (value) {
        return _this5.buildEnumValue(value);
      }),
      astNode: astNode
    });
  };

  _proto._makeUnionDef = function _makeUnionDef(astNode) {
    var _this6 = this;

    var typeNodes = astNode.types; // Note: While this could make assertions to get the correctly typed
    // values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.

    var types = typeNodes && typeNodes.length > 0 ? function () {
      return typeNodes.map(function (ref) {
        return _this6.buildType(ref);
      });
    } : [];
    return new GraphQLUnionType({
      name: astNode.name.value,
      description: getDescription(astNode, this._options),
      types: types,
      astNode: astNode
    });
  };

  _proto._makeScalarDef = function _makeScalarDef(astNode) {
    return new GraphQLScalarType({
      name: astNode.name.value,
      description: getDescription(astNode, this._options),
      astNode: astNode,
      serialize: function serialize(value) {
        return value;
      }
    });
  };

  _proto._makeInputObjectDef = function _makeInputObjectDef(def) {
    var _this7 = this;

    var fields = def.fields;
    return new GraphQLInputObjectType({
      name: def.name.value,
      description: getDescription(def, this._options),
      fields: fields ? function () {
        return keyByNameNode(fields, function (field) {
          return _this7.buildInputField(field);
        });
      } : Object.create(null),
      astNode: def
    });
  };

  return ASTDefinitionBuilder;
}();

function keyByNameNode(list, valFn) {
  return keyValMap(list, function (_ref2) {
    var name = _ref2.name;
    return name.value;
  }, valFn);
}
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
      return blockStringValue('\n' + rawValue);
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

  return comments.reverse().join('\n');
}
/**
 * A helper function to build a GraphQLSchema directly from a source
 * document.
 */


export function buildSchema(source, options) {
  return buildASTSchema(parse(source, options), options);
}