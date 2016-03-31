'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

exports.extendSchema = extendSchema;

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _keyMap = require('../jsutils/keyMap');

var _keyMap2 = _interopRequireDefault(_keyMap);

var _keyValMap = require('../jsutils/keyValMap');

var _keyValMap2 = _interopRequireDefault(_keyValMap);

var _valueFromAST = require('./valueFromAST');

var _GraphQLError = require('../error/GraphQLError');

var _schema = require('../type/schema');

var _definition = require('../type/definition');

var _introspection = require('../type/introspection');

var _scalars = require('../type/scalars');

var _kinds = require('../language/kinds');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function extendSchema(schema, documentAST) {
  (0, _invariant2.default)(schema instanceof _schema.GraphQLSchema, 'Must provide valid GraphQLSchema');

  (0, _invariant2.default)(documentAST && documentAST.kind === _kinds.DOCUMENT, 'Must provide valid Document AST');

  // Collect the type definitions and extensions found in the document.
  var typeDefinitionMap = {};
  var typeExtensionsMap = {};

  for (var i = 0; i < documentAST.definitions.length; i++) {
    var def = documentAST.definitions[i];
    switch (def.kind) {
      case _kinds.OBJECT_TYPE_DEFINITION:
      case _kinds.INTERFACE_TYPE_DEFINITION:
      case _kinds.ENUM_TYPE_DEFINITION:
      case _kinds.UNION_TYPE_DEFINITION:
      case _kinds.SCALAR_TYPE_DEFINITION:
      case _kinds.INPUT_OBJECT_TYPE_DEFINITION:
        // Sanity check that none of the defined types conflict with the
        // schema's existing types.
        var typeName = def.name.value;
        if (schema.getType(typeName)) {
          throw new _GraphQLError.GraphQLError('Type "' + typeName + '" already exists in the schema. It cannot also ' + 'be defined in this type definition.', [def]);
        }
        typeDefinitionMap[typeName] = def;
        break;
      case _kinds.TYPE_EXTENSION_DEFINITION:
        // Sanity check that this type extension exists within the
        // schema's existing types.
        var extendedTypeName = def.definition.name.value;
        var existingType = schema.getType(extendedTypeName);
        if (!existingType) {
          throw new _GraphQLError.GraphQLError('Cannot extend type "' + extendedTypeName + '" because it does not ' + 'exist in the existing schema.', [def.definition]);
        }
        if (!(existingType instanceof _definition.GraphQLObjectType)) {
          throw new _GraphQLError.GraphQLError('Cannot extend non-object type "' + extendedTypeName + '".', [def.definition]);
        }
        var extensions = typeExtensionsMap[extendedTypeName];
        if (extensions) {
          extensions.push(def);
        } else {
          extensions = [def];
        }
        typeExtensionsMap[extendedTypeName] = extensions;
        break;
    }
  }

  // If this document contains no new types, then return the same unmodified
  // GraphQLSchema instance.
  if ((0, _keys2.default)(typeExtensionsMap).length === 0 && (0, _keys2.default)(typeDefinitionMap).length === 0) {
    return schema;
  }

  // A cache to use to store the actual GraphQLType definition objects by name.
  // Initialize to the GraphQL built in scalars and introspection types. All
  // functions below are inline so that this type def cache is within the scope
  // of the closure.
  var typeDefCache = {
    String: _scalars.GraphQLString,
    Int: _scalars.GraphQLInt,
    Float: _scalars.GraphQLFloat,
    Boolean: _scalars.GraphQLBoolean,
    ID: _scalars.GraphQLID,
    __Schema: _introspection.__Schema,
    __Directive: _introspection.__Directive,
    __DirectiveLocation: _introspection.__DirectiveLocation,
    __Type: _introspection.__Type,
    __Field: _introspection.__Field,
    __InputValue: _introspection.__InputValue,
    __EnumValue: _introspection.__EnumValue,
    __TypeKind: _introspection.__TypeKind
  };

  // Get the root Query, Mutation, and Subscription types.
  var queryType = getTypeFromDef(schema.getQueryType());

  var existingMutationType = schema.getMutationType();
  var mutationType = existingMutationType ? getTypeFromDef(existingMutationType) : null;

  var existingSubscriptionType = schema.getSubscriptionType();
  var subscriptionType = existingSubscriptionType ? getTypeFromDef(existingSubscriptionType) : null;

  // Iterate through all types, getting the type definition for each, ensuring
  // that any type not directly referenced by a field will get created.
  var types = (0, _keys2.default)(schema.getTypeMap()).map(function (typeName) {
    return getTypeFromDef(schema.getType(typeName));
  });

  // Do the same with new types, appending to the list of defined types.
  (0, _keys2.default)(typeDefinitionMap).forEach(function (typeName) {
    types.push(getTypeFromAST(typeDefinitionMap[typeName]));
  });

  // Then produce and return a Schema with these types.
  return new _schema.GraphQLSchema({
    query: queryType,
    mutation: mutationType,
    subscription: subscriptionType,
    types: types,
    // Copy directives.
    directives: schema.getDirectives()
  });

  // Below are functions used for producing this schema that have closed over
  // this scope and have access to the schema, cache, and newly defined types.

  function getTypeFromDef(typeDef) {
    var type = _getNamedType(typeDef.name);
    (0, _invariant2.default)(type, 'Invalid schema');
    return type;
  }

  function getTypeFromAST(astNode) {
    var type = _getNamedType(astNode.name.value);
    if (!type) {
      throw new _GraphQLError.GraphQLError('Unknown type: "' + astNode.name.value + '". Ensure that this type exists ' + 'either in the original schema, or is added in a type definition.', [astNode]);
    }
    return type;
  }

  // Given a name, returns a type from either the existing schema or an
  // added type.
  function _getNamedType(typeName) {
    var cachedTypeDef = typeDefCache[typeName];
    if (cachedTypeDef) {
      return cachedTypeDef;
    }

    var existingType = schema.getType(typeName);
    if (existingType) {
      var typeDef = extendType(existingType);
      typeDefCache[typeName] = typeDef;
      return typeDef;
    }

    var typeAST = typeDefinitionMap[typeName];
    if (typeAST) {
      var _typeDef = buildType(typeAST);
      typeDefCache[typeName] = _typeDef;
      return _typeDef;
    }
  }

  // Given a type's introspection result, construct the correct
  // GraphQLType instance.
  function extendType(type) {
    if (type instanceof _definition.GraphQLObjectType) {
      return extendObjectType(type);
    }
    if (type instanceof _definition.GraphQLInterfaceType) {
      return extendInterfaceType(type);
    }
    if (type instanceof _definition.GraphQLUnionType) {
      return extendUnionType(type);
    }
    return type;
  }

  function extendObjectType(type) {
    return new _definition.GraphQLObjectType({
      name: type.name,
      description: type.description,
      interfaces: function interfaces() {
        return extendImplementedInterfaces(type);
      },
      fields: function fields() {
        return extendFieldMap(type);
      }
    });
  }

  function extendInterfaceType(type) {
    return new _definition.GraphQLInterfaceType({
      name: type.name,
      description: type.description,
      fields: function fields() {
        return extendFieldMap(type);
      },
      resolveType: cannotExecuteClientSchema
    });
  }

  function extendUnionType(type) {
    return new _definition.GraphQLUnionType({
      name: type.name,
      description: type.description,
      types: type.getTypes().map(getTypeFromDef),
      resolveType: cannotExecuteClientSchema
    });
  }

  function extendImplementedInterfaces(type) {
    var interfaces = type.getInterfaces().map(getTypeFromDef);

    // If there are any extensions to the interfaces, apply those here.
    var extensions = typeExtensionsMap[type.name];
    if (extensions) {
      extensions.forEach(function (extension) {
        extension.definition.interfaces.forEach(function (namedType) {
          var interfaceName = namedType.name.value;
          if (interfaces.some(function (def) {
            return def.name === interfaceName;
          })) {
            throw new _GraphQLError.GraphQLError('Type "' + type.name + '" already implements "' + interfaceName + '". ' + 'It cannot also be implemented in this type extension.', [namedType]);
          }
          interfaces.push(getTypeFromAST(namedType));
        });
      });
    }

    return interfaces;
  }

  function extendFieldMap(type) {
    var newFieldMap = {};
    var oldFieldMap = type.getFields();
    (0, _keys2.default)(oldFieldMap).forEach(function (fieldName) {
      var field = oldFieldMap[fieldName];
      newFieldMap[fieldName] = {
        description: field.description,
        deprecationReason: field.deprecationReason,
        type: extendFieldType(field.type),
        args: (0, _keyMap2.default)(field.args, function (arg) {
          return arg.name;
        }),
        resolve: cannotExecuteClientSchema
      };
    });

    // If there are any extensions to the fields, apply those here.
    var extensions = typeExtensionsMap[type.name];
    if (extensions) {
      extensions.forEach(function (extension) {
        extension.definition.fields.forEach(function (field) {
          var fieldName = field.name.value;
          if (oldFieldMap[fieldName]) {
            throw new _GraphQLError.GraphQLError('Field "' + type.name + '.' + fieldName + '" already exists in the ' + 'schema. It cannot also be defined in this type extension.', [field]);
          }
          newFieldMap[fieldName] = {
            type: buildFieldType(field.type),
            args: buildInputValues(field.arguments),
            resolve: cannotExecuteClientSchema
          };
        });
      });
    }

    return newFieldMap;
  }

  function extendFieldType(type) {
    if (type instanceof _definition.GraphQLList) {
      return new _definition.GraphQLList(extendFieldType(type.ofType));
    }
    if (type instanceof _definition.GraphQLNonNull) {
      return new _definition.GraphQLNonNull(extendFieldType(type.ofType));
    }
    return getTypeFromDef(type);
  }

  function buildType(typeAST) {
    switch (typeAST.kind) {
      case _kinds.OBJECT_TYPE_DEFINITION:
        return buildObjectType(typeAST);
      case _kinds.INTERFACE_TYPE_DEFINITION:
        return buildInterfaceType(typeAST);
      case _kinds.UNION_TYPE_DEFINITION:
        return buildUnionType(typeAST);
      case _kinds.SCALAR_TYPE_DEFINITION:
        return buildScalarType(typeAST);
      case _kinds.ENUM_TYPE_DEFINITION:
        return buildEnumType(typeAST);
      case _kinds.INPUT_OBJECT_TYPE_DEFINITION:
        return buildInputObjectType(typeAST);
    }
  }

  function buildObjectType(typeAST) {
    return new _definition.GraphQLObjectType({
      name: typeAST.name.value,
      interfaces: function interfaces() {
        return buildImplementedInterfaces(typeAST);
      },
      fields: function fields() {
        return buildFieldMap(typeAST);
      }
    });
  }

  function buildInterfaceType(typeAST) {
    return new _definition.GraphQLInterfaceType({
      name: typeAST.name.value,
      fields: function fields() {
        return buildFieldMap(typeAST);
      },
      resolveType: cannotExecuteClientSchema
    });
  }

  function buildUnionType(typeAST) {
    return new _definition.GraphQLUnionType({
      name: typeAST.name.value,
      types: typeAST.types.map(getTypeFromAST),
      resolveType: cannotExecuteClientSchema
    });
  }

  function buildScalarType(typeAST) {
    return new _definition.GraphQLScalarType({
      name: typeAST.name.value,
      serialize: function serialize() {
        return null;
      },
      // Note: validation calls the parse functions to determine if a
      // literal value is correct. Returning null would cause use of custom
      // scalars to always fail validation. Returning false causes them to
      // always pass validation.
      parseValue: function parseValue() {
        return false;
      },
      parseLiteral: function parseLiteral() {
        return false;
      }
    });
  }

  function buildEnumType(typeAST) {
    return new _definition.GraphQLEnumType({
      name: typeAST.name.value,
      values: (0, _keyValMap2.default)(typeAST.values, function (v) {
        return v.name.value;
      }, function () {
        return {};
      })
    });
  }

  function buildInputObjectType(typeAST) {
    return new _definition.GraphQLInputObjectType({
      name: typeAST.name.value,
      fields: function fields() {
        return buildInputValues(typeAST.fields);
      }
    });
  }

  function buildImplementedInterfaces(typeAST) {
    return typeAST.interfaces.map(getTypeFromAST);
  }

  function buildFieldMap(typeAST) {
    return (0, _keyValMap2.default)(typeAST.fields, function (field) {
      return field.name.value;
    }, function (field) {
      return {
        type: buildFieldType(field.type),
        args: buildInputValues(field.arguments),
        resolve: cannotExecuteClientSchema
      };
    });
  }

  function buildInputValues(values) {
    return (0, _keyValMap2.default)(values, function (value) {
      return value.name.value;
    }, function (value) {
      var type = buildFieldType(value.type);
      return {
        type: type,
        defaultValue: (0, _valueFromAST.valueFromAST)(value.defaultValue, type)
      };
    });
  }

  function buildFieldType(typeAST) {
    if (typeAST.kind === _kinds.LIST_TYPE) {
      return new _definition.GraphQLList(buildFieldType(typeAST.type));
    }
    if (typeAST.kind === _kinds.NON_NULL_TYPE) {
      return new _definition.GraphQLNonNull(buildFieldType(typeAST.type));
    }
    return getTypeFromAST(typeAST);
  }
}

function cannotExecuteClientSchema() {
  throw new Error('Client Schema cannot be used for execution.');
}