function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

import keyMap from '../jsutils/keyMap';
import keyValMap from '../jsutils/keyValMap';

import { valueFromAST } from './valueFromAST';
import blockStringValue from '../language/blockStringValue';
import { TokenKind } from '../language/lexer';
import { parse } from '../language/parser';

import { getDirectiveValues } from '../execution/values';
import { Kind } from '../language/kinds';

import { assertNullableType, GraphQLScalarType, GraphQLObjectType, GraphQLInterfaceType, GraphQLUnionType, GraphQLEnumType, GraphQLInputObjectType } from '../type/definition';

import { GraphQLList, GraphQLNonNull } from '../type/wrappers';

import { GraphQLDirective, GraphQLSkipDirective, GraphQLIncludeDirective, GraphQLDeprecatedDirective } from '../type/directives';

import { introspectionTypes } from '../type/introspection';

import { specifiedScalarTypes } from '../type/scalars';

import { GraphQLSchema } from '../type/schema';

function buildWrappedType(innerType, inputTypeNode) {
  if (inputTypeNode.kind === Kind.LIST_TYPE) {
    return GraphQLList(buildWrappedType(innerType, inputTypeNode.type));
  }
  if (inputTypeNode.kind === Kind.NON_NULL_TYPE) {
    var wrappedType = buildWrappedType(innerType, inputTypeNode.type);
    return GraphQLNonNull(assertNullableType(wrappedType));
  }
  return innerType;
}

function getNamedTypeNode(typeNode) {
  var namedType = typeNode;
  while (namedType.kind === Kind.LIST_TYPE || namedType.kind === Kind.NON_NULL_TYPE) {
    namedType = namedType.type;
  }
  return namedType;
}

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
export function buildASTSchema(ast, options) {
  if (!ast || ast.kind !== Kind.DOCUMENT) {
    throw new Error('Must provide a document ast.');
  }

  var schemaDef = void 0;

  var typeDefs = [];
  var nodeMap = Object.create(null);
  var directiveDefs = [];
  for (var i = 0; i < ast.definitions.length; i++) {
    var d = ast.definitions[i];
    switch (d.kind) {
      case Kind.SCHEMA_DEFINITION:
        if (schemaDef) {
          throw new Error('Must provide only one schema definition.');
        }
        schemaDef = d;
        break;
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        var _typeName = d.name.value;
        if (nodeMap[_typeName]) {
          throw new Error('Type "' + _typeName + '" was defined more than once.');
        }
        typeDefs.push(d);
        nodeMap[_typeName] = d;
        break;
      case Kind.DIRECTIVE_DEFINITION:
        directiveDefs.push(d);
        break;
    }
  }

  var operationTypes = schemaDef ? getOperationTypes(schemaDef) : {
    query: nodeMap.Query ? 'Query' : null,
    mutation: nodeMap.Mutation ? 'Mutation' : null,
    subscription: nodeMap.Subscription ? 'Subscription' : null
  };

  var definitionBuilder = new ASTDefinitionBuilder(nodeMap, options, function (typeName) {
    throw new Error('Type "' + typeName + '" not found in document.');
  });

  var types = typeDefs.map(function (def) {
    return definitionBuilder.buildType(def.name.value);
  });

  var directives = directiveDefs.map(function (def) {
    return definitionBuilder.buildDirective(def);
  });

  // If specified directives were not explicitly declared, add them.
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

  // Note: While this could make early assertions to get the correctly
  // typed values below, that would throw immediately while type system
  // validation with validateSchema() will produce more actionable results.
  return new GraphQLSchema({
    query: operationTypes.query ? definitionBuilder.buildType(operationTypes.query) : null,
    mutation: operationTypes.mutation ? definitionBuilder.buildType(operationTypes.mutation) : null,
    subscription: operationTypes.subscription ? definitionBuilder.buildType(operationTypes.subscription) : null,
    types: types,
    directives: directives,
    astNode: schemaDef,
    assumeValid: options && options.assumeValid
  });

  function getOperationTypes(schema) {
    var opTypes = {};
    schema.operationTypes.forEach(function (operationType) {
      var typeName = operationType.type.name.value;
      var operation = operationType.operation;
      if (opTypes[operation]) {
        throw new Error('Must provide only one ' + operation + ' type in schema.');
      }
      if (!nodeMap[typeName]) {
        throw new Error('Specified ' + operation + ' type "' + typeName + '" not found in document.');
      }
      opTypes[operation] = typeName;
    });
    return opTypes;
  }
}

export var ASTDefinitionBuilder = function () {
  function ASTDefinitionBuilder(typeDefinitionsMap, options, resolveType) {
    _classCallCheck(this, ASTDefinitionBuilder);

    this._typeDefinitionsMap = typeDefinitionsMap;
    this._options = options;
    this._resolveType = resolveType;
    // Initialize to the GraphQL built in scalars and introspection types.
    this._cache = keyMap(specifiedScalarTypes.concat(introspectionTypes), function (type) {
      return type.name;
    });
  }

  ASTDefinitionBuilder.prototype._buildType = function _buildType(typeName, typeNode) {
    if (!this._cache[typeName]) {
      var defNode = this._typeDefinitionsMap[typeName];
      if (defNode) {
        this._cache[typeName] = this._makeSchemaDef(defNode);
      } else {
        this._cache[typeName] = this._resolveType(typeName, typeNode);
      }
    }
    return this._cache[typeName];
  };

  ASTDefinitionBuilder.prototype.buildType = function buildType(ref) {
    if (typeof ref === 'string') {
      return this._buildType(ref);
    }
    return this._buildType(ref.name.value, ref);
  };

  ASTDefinitionBuilder.prototype._buildWrappedType = function _buildWrappedType(typeNode) {
    var typeDef = this.buildType(getNamedTypeNode(typeNode));
    return buildWrappedType(typeDef, typeNode);
  };

  ASTDefinitionBuilder.prototype.buildDirective = function buildDirective(directiveNode) {
    return new GraphQLDirective({
      name: directiveNode.name.value,
      description: getDescription(directiveNode, this._options),
      locations: directiveNode.locations.map(function (node) {
        return node.value;
      }),
      args: directiveNode.arguments && this._makeInputValues(directiveNode.arguments),
      astNode: directiveNode
    });
  };

  ASTDefinitionBuilder.prototype.buildField = function buildField(field) {
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

  ASTDefinitionBuilder.prototype._makeSchemaDef = function _makeSchemaDef(def) {
    switch (def.kind) {
      case Kind.OBJECT_TYPE_DEFINITION:
        return this._makeTypeDef(def);
      case Kind.INTERFACE_TYPE_DEFINITION:
        return this._makeInterfaceDef(def);
      case Kind.ENUM_TYPE_DEFINITION:
        return this._makeEnumDef(def);
      case Kind.UNION_TYPE_DEFINITION:
        return this._makeUnionDef(def);
      case Kind.SCALAR_TYPE_DEFINITION:
        return this._makeScalarDef(def);
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        return this._makeInputObjectDef(def);
      default:
        throw new Error('Type kind "' + def.kind + '" not supported.');
    }
  };

  ASTDefinitionBuilder.prototype._makeTypeDef = function _makeTypeDef(def) {
    var _this = this;

    var typeName = def.name.value;
    return new GraphQLObjectType({
      name: typeName,
      description: getDescription(def, this._options),
      fields: function fields() {
        return _this._makeFieldDefMap(def);
      },
      interfaces: function interfaces() {
        return _this._makeImplementedInterfaces(def);
      },
      astNode: def
    });
  };

  ASTDefinitionBuilder.prototype._makeFieldDefMap = function _makeFieldDefMap(def) {
    var _this2 = this;

    return def.fields ? keyValMap(def.fields, function (field) {
      return field.name.value;
    }, function (field) {
      return _this2.buildField(field);
    }) : {};
  };

  ASTDefinitionBuilder.prototype._makeImplementedInterfaces = function _makeImplementedInterfaces(def) {
    var _this3 = this;

    return def.interfaces &&
    // Note: While this could make early assertions to get the correctly
    // typed values, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    def.interfaces.map(function (iface) {
      return _this3.buildType(iface);
    });
  };

  ASTDefinitionBuilder.prototype._makeInputValues = function _makeInputValues(values) {
    var _this4 = this;

    return keyValMap(values, function (value) {
      return value.name.value;
    }, function (value) {
      // Note: While this could make assertions to get the correctly typed
      // value, that would throw immediately while type system validation
      var type = _this4._buildWrappedType(value.type);
      return {
        type: type,
        description: getDescription(value, _this4._options),
        defaultValue: valueFromAST(value.defaultValue, type),
        astNode: value
      };
    });
  };

  ASTDefinitionBuilder.prototype._makeInterfaceDef = function _makeInterfaceDef(def) {
    var _this5 = this;

    return new GraphQLInterfaceType({
      name: def.name.value,
      description: getDescription(def, this._options),
      fields: function fields() {
        return _this5._makeFieldDefMap(def);
      },
      astNode: def
    });
  };

  ASTDefinitionBuilder.prototype._makeEnumDef = function _makeEnumDef(def) {
    var _this6 = this;

    return new GraphQLEnumType({
      name: def.name.value,
      description: getDescription(def, this._options),
      values: def.values ? keyValMap(def.values, function (enumValue) {
        return enumValue.name.value;
      }, function (enumValue) {
        return {
          description: getDescription(enumValue, _this6._options),
          deprecationReason: getDeprecationReason(enumValue),
          astNode: enumValue
        };
      }) : {},
      astNode: def
    });
  };

  ASTDefinitionBuilder.prototype._makeUnionDef = function _makeUnionDef(def) {
    var _this7 = this;

    return new GraphQLUnionType({
      name: def.name.value,
      description: getDescription(def, this._options),
      // Note: While this could make assertions to get the correctly typed
      // values below, that would throw immediately while type system
      // validation with validateSchema() will produce more actionable results.
      types: def.types ? def.types.map(function (t) {
        return _this7.buildType(t);
      }) : [],
      astNode: def
    });
  };

  ASTDefinitionBuilder.prototype._makeScalarDef = function _makeScalarDef(def) {
    return new GraphQLScalarType({
      name: def.name.value,
      description: getDescription(def, this._options),
      astNode: def,
      serialize: function serialize(value) {
        return value;
      }
    });
  };

  ASTDefinitionBuilder.prototype._makeInputObjectDef = function _makeInputObjectDef(def) {
    var _this8 = this;

    return new GraphQLInputObjectType({
      name: def.name.value,
      description: getDescription(def, this._options),
      fields: function fields() {
        return def.fields ? _this8._makeInputValues(def.fields) : {};
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
function getDeprecationReason(node) {
  var deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
  return deprecated && deprecated.reason;
}

/**
 * Given an ast node, returns its string description.
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
export function buildSchema(source) {
  return buildASTSchema(parse(source));
}