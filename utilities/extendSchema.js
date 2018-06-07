"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.extendSchema = extendSchema;

var _invariant = _interopRequireDefault(require("../jsutils/invariant"));

var _keyMap = _interopRequireDefault(require("../jsutils/keyMap"));

var _keyValMap = _interopRequireDefault(require("../jsutils/keyValMap"));

var _objectValues = _interopRequireDefault(require("../jsutils/objectValues"));

var _buildASTSchema = require("./buildASTSchema");

var _GraphQLError = require("../error/GraphQLError");

var _schema = require("../type/schema");

var _introspection = require("../type/introspection");

var _definition = require("../type/definition");

var _directives = require("../type/directives");

var _kinds = require("../language/kinds");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */

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
  !(0, _schema.isSchema)(schema) ? (0, _invariant.default)(0, 'Must provide valid GraphQLSchema') : void 0;
  !(documentAST && documentAST.kind === _kinds.Kind.DOCUMENT) ? (0, _invariant.default)(0, 'Must provide valid Document AST') : void 0; // Collect the type definitions and extensions found in the document.

  var typeDefinitionMap = Object.create(null);
  var typeExtensionsMap = Object.create(null); // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".

  var directiveDefinitions = []; // Schema extensions are collected which may add additional operation types.

  var schemaExtensions = [];

  for (var i = 0; i < documentAST.definitions.length; i++) {
    var def = documentAST.definitions[i];

    switch (def.kind) {
      case _kinds.Kind.SCHEMA_DEFINITION:
        // Sanity check that a schema extension is not defining a new schema
        throw new _GraphQLError.GraphQLError('Cannot define a new schema within a schema extension.', [def]);

      case _kinds.Kind.SCHEMA_EXTENSION:
        schemaExtensions.push(def);
        break;

      case _kinds.Kind.OBJECT_TYPE_DEFINITION:
      case _kinds.Kind.INTERFACE_TYPE_DEFINITION:
      case _kinds.Kind.ENUM_TYPE_DEFINITION:
      case _kinds.Kind.UNION_TYPE_DEFINITION:
      case _kinds.Kind.SCALAR_TYPE_DEFINITION:
      case _kinds.Kind.INPUT_OBJECT_TYPE_DEFINITION:
        // Sanity check that none of the defined types conflict with the
        // schema's existing types.
        var typeName = def.name.value;

        if (schema.getType(typeName)) {
          throw new _GraphQLError.GraphQLError("Type \"".concat(typeName, "\" already exists in the schema. It cannot also ") + 'be defined in this type definition.', [def]);
        }

        typeDefinitionMap[typeName] = def;
        break;

      case _kinds.Kind.OBJECT_TYPE_EXTENSION:
      case _kinds.Kind.INTERFACE_TYPE_EXTENSION:
      case _kinds.Kind.ENUM_TYPE_EXTENSION:
      case _kinds.Kind.INPUT_OBJECT_TYPE_EXTENSION:
      case _kinds.Kind.UNION_TYPE_EXTENSION:
        // Sanity check that this type extension exists within the
        // schema's existing types.
        var extendedTypeName = def.name.value;
        var existingType = schema.getType(extendedTypeName);

        if (!existingType) {
          throw new _GraphQLError.GraphQLError("Cannot extend type \"".concat(extendedTypeName, "\" because it does not ") + 'exist in the existing schema.', [def]);
        }

        checkExtensionNode(existingType, def);
        var existingTypeExtensions = typeExtensionsMap[extendedTypeName];
        typeExtensionsMap[extendedTypeName] = existingTypeExtensions ? existingTypeExtensions.concat([def]) : [def];
        break;

      case _kinds.Kind.DIRECTIVE_DEFINITION:
        var directiveName = def.name.value;
        var existingDirective = schema.getDirective(directiveName);

        if (existingDirective) {
          throw new _GraphQLError.GraphQLError("Directive \"".concat(directiveName, "\" already exists in the schema. It ") + 'cannot be redefined.', [def]);
        }

        directiveDefinitions.push(def);
        break;

      case _kinds.Kind.SCALAR_TYPE_EXTENSION:
        throw new Error("The ".concat(def.kind, " kind is not yet supported by extendSchema()."));
    }
  } // If this document contains no new types, extensions, or directives then
  // return the same unmodified GraphQLSchema instance.


  if (Object.keys(typeExtensionsMap).length === 0 && Object.keys(typeDefinitionMap).length === 0 && directiveDefinitions.length === 0 && schemaExtensions.length === 0) {
    return schema;
  }

  var astBuilder = new _buildASTSchema.ASTDefinitionBuilder(typeDefinitionMap, options, function (typeRef) {
    var typeName = typeRef.name.value;
    var existingType = schema.getType(typeName);

    if (existingType) {
      return extendNamedType(existingType);
    }

    throw new _GraphQLError.GraphQLError("Unknown type: \"".concat(typeName, "\". Ensure that this type exists ") + 'either in the original schema, or is added in a type definition.', [typeRef]);
  });
  var extendTypeCache = Object.create(null); // Get the extended root operation types.

  var operationTypes = {
    query: extendMaybeNamedType(schema.getQueryType()),
    mutation: extendMaybeNamedType(schema.getMutationType()),
    subscription: extendMaybeNamedType(schema.getSubscriptionType())
  }; // Then, incorporate all schema extensions.

  schemaExtensions.forEach(function (schemaExtension) {
    if (schemaExtension.operationTypes) {
      schemaExtension.operationTypes.forEach(function (operationType) {
        var operation = operationType.operation;

        if (operationTypes[operation]) {
          throw new Error("Must provide only one ".concat(operation, " type in schema."));
        }

        var typeRef = operationType.type; // Note: While this could make early assertions to get the correctly
        // typed values, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable results.

        operationTypes[operation] = astBuilder.buildType(typeRef);
      });
    }
  });
  var schemaExtensionASTNodes = schemaExtensions ? schema.extensionASTNodes ? schema.extensionASTNodes.concat(schemaExtensions) : schemaExtensions : schema.extensionASTNodes;
  var types = (0, _objectValues.default)(schema.getTypeMap()).map(function (type) {
    return extendNamedType(type);
  }).concat(astBuilder.buildTypes((0, _objectValues.default)(typeDefinitionMap))); // Support both original legacy names and extended legacy names.

  var allowedLegacyNames = schema.__allowedLegacyNames.concat(options && options.allowedLegacyNames || []); // Then produce and return a Schema with these types.


  return new _schema.GraphQLSchema({
    query: operationTypes.query,
    mutation: operationTypes.mutation,
    subscription: operationTypes.subscription,
    types: types,
    directives: getMergedDirectives(),
    astNode: schema.astNode,
    extensionASTNodes: schemaExtensionASTNodes,
    allowedLegacyNames: allowedLegacyNames
  }); // Below are functions used for producing this schema that have closed over
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
    if ((0, _introspection.isIntrospectionType)(type)) {
      // Introspection types are not extended.
      return type;
    }

    var name = type.name;

    if (!extendTypeCache[name]) {
      if ((0, _definition.isObjectType)(type)) {
        extendTypeCache[name] = extendObjectType(type);
      } else if ((0, _definition.isInterfaceType)(type)) {
        extendTypeCache[name] = extendInterfaceType(type);
      } else if ((0, _definition.isUnionType)(type)) {
        extendTypeCache[name] = extendUnionType(type);
      } else if ((0, _definition.isEnumType)(type)) {
        extendTypeCache[name] = extendEnumType(type);
      } else if ((0, _definition.isInputObjectType)(type)) {
        extendTypeCache[name] = extendInputObjectType(type);
      } else {
        // This type is not yet extendable.
        extendTypeCache[name] = type;
      }
    }

    return extendTypeCache[name];
  }

  function extendDirective(directive) {
    return new _directives.GraphQLDirective({
      name: directive.name,
      description: directive.description,
      locations: directive.locations,
      args: extendArgs(directive.args),
      astNode: directive.astNode
    });
  }

  function getExtendedType(type) {
    if (!extendTypeCache[type.name]) {
      extendTypeCache[type.name] = extendType(type);
    }

    return extendTypeCache[type.name];
  }

  function extendInputObjectType(type) {
    var name = type.name;
    var extensionASTNodes = typeExtensionsMap[name] ? type.extensionASTNodes ? type.extensionASTNodes.concat(typeExtensionsMap[name]) : typeExtensionsMap[name] : type.extensionASTNodes;
    return new _definition.GraphQLInputObjectType({
      name: name,
      description: type.description,
      fields: function fields() {
        return extendInputFieldMap(type);
      },
      astNode: type.astNode,
      extensionASTNodes: extensionASTNodes
    });
  }

  function extendInputFieldMap(type) {
    var newFieldMap = Object.create(null);
    var oldFieldMap = type.getFields();
    Object.keys(oldFieldMap).forEach(function (fieldName) {
      var field = oldFieldMap[fieldName];
      newFieldMap[fieldName] = {
        description: field.description,
        type: extendType(field.type),
        defaultValue: field.defaultValue,
        astNode: field.astNode
      };
    }); // If there are any extensions to the fields, apply those here.

    var extensions = typeExtensionsMap[type.name];

    if (extensions) {
      extensions.forEach(function (extension) {
        extension.fields.forEach(function (field) {
          var fieldName = field.name.value;

          if (oldFieldMap[fieldName]) {
            throw new _GraphQLError.GraphQLError("Field \"".concat(type.name, ".").concat(fieldName, "\" already exists in the ") + 'schema. It cannot also be defined in this type extension.', [field]);
          }

          newFieldMap[fieldName] = astBuilder.buildInputField(field);
        });
      });
    }

    return newFieldMap;
  }

  function extendEnumType(type) {
    var name = type.name;
    var extensionASTNodes = typeExtensionsMap[name] ? type.extensionASTNodes ? type.extensionASTNodes.concat(typeExtensionsMap[name]) : typeExtensionsMap[name] : type.extensionASTNodes;
    return new _definition.GraphQLEnumType({
      name: name,
      description: type.description,
      values: extendValueMap(type),
      astNode: type.astNode,
      extensionASTNodes: extensionASTNodes
    });
  }

  function extendValueMap(type) {
    var newValueMap = Object.create(null);
    var oldValueMap = (0, _keyMap.default)(type.getValues(), function (value) {
      return value.name;
    });
    Object.keys(oldValueMap).forEach(function (valueName) {
      var value = oldValueMap[valueName];
      newValueMap[valueName] = {
        name: value.name,
        description: value.description,
        value: value.value,
        deprecationReason: value.deprecationReason,
        astNode: value.astNode
      };
    }); // If there are any extensions to the values, apply those here.

    var extensions = typeExtensionsMap[type.name];

    if (extensions) {
      extensions.forEach(function (extension) {
        extension.values.forEach(function (value) {
          var valueName = value.name.value;

          if (oldValueMap[valueName]) {
            throw new _GraphQLError.GraphQLError("Enum value \"".concat(type.name, ".").concat(valueName, "\" already exists in the ") + 'schema. It cannot also be defined in this type extension.', [value]);
          }

          newValueMap[valueName] = astBuilder.buildEnumValue(value);
        });
      });
    }

    return newValueMap;
  }

  function extendObjectType(type) {
    var name = type.name;
    var extensionASTNodes = typeExtensionsMap[name] ? type.extensionASTNodes ? type.extensionASTNodes.concat(typeExtensionsMap[name]) : typeExtensionsMap[name] : type.extensionASTNodes;
    return new _definition.GraphQLObjectType({
      name: name,
      description: type.description,
      interfaces: function interfaces() {
        return extendImplementedInterfaces(type);
      },
      fields: function fields() {
        return extendFieldMap(type);
      },
      astNode: type.astNode,
      extensionASTNodes: extensionASTNodes,
      isTypeOf: type.isTypeOf
    });
  }

  function extendArgs(args) {
    return (0, _keyValMap.default)(args, function (arg) {
      return arg.name;
    }, function (arg) {
      return {
        type: extendType(arg.type),
        defaultValue: arg.defaultValue,
        description: arg.description,
        astNode: arg.astNode
      };
    });
  }

  function extendInterfaceType(type) {
    var name = type.name;
    var extensionASTNodes = typeExtensionsMap[name] ? type.extensionASTNodes ? type.extensionASTNodes.concat(typeExtensionsMap[name]) : typeExtensionsMap[name] : type.extensionASTNodes;
    return new _definition.GraphQLInterfaceType({
      name: type.name,
      description: type.description,
      fields: function fields() {
        return extendFieldMap(type);
      },
      astNode: type.astNode,
      extensionASTNodes: extensionASTNodes,
      resolveType: type.resolveType
    });
  }

  function extendUnionType(type) {
    var name = type.name;
    var extensionASTNodes = typeExtensionsMap[name] ? type.extensionASTNodes ? type.extensionASTNodes.concat(typeExtensionsMap[name]) : typeExtensionsMap[name] : type.extensionASTNodes;
    var unionTypes = type.getTypes().map(getExtendedType); // If there are any extensions to the union, apply those here.

    var extensions = typeExtensionsMap[type.name];

    if (extensions) {
      extensions.forEach(function (extension) {
        extension.types.forEach(function (namedType) {
          // Note: While this could make early assertions to get the correctly
          // typed values, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable results.
          unionTypes.push(astBuilder.buildType(namedType));
        });
      });
    }

    return new _definition.GraphQLUnionType({
      name: name,
      description: type.description,
      types: unionTypes,
      astNode: type.astNode,
      resolveType: type.resolveType,
      extensionASTNodes: extensionASTNodes
    });
  }

  function extendImplementedInterfaces(type) {
    var interfaces = type.getInterfaces().map(extendNamedType); // If there are any extensions to the interfaces, apply those here.

    var extensions = typeExtensionsMap[type.name];

    if (extensions) {
      extensions.forEach(function (extension) {
        extension.interfaces.forEach(function (namedType) {
          // Note: While this could make early assertions to get the correctly
          // typed values, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable results.
          interfaces.push(astBuilder.buildType(namedType));
        });
      });
    }

    return interfaces;
  }

  function extendFieldMap(type) {
    var newFieldMap = Object.create(null);
    var oldFieldMap = type.getFields();
    Object.keys(oldFieldMap).forEach(function (fieldName) {
      var field = oldFieldMap[fieldName];
      newFieldMap[fieldName] = {
        description: field.description,
        deprecationReason: field.deprecationReason,
        type: extendType(field.type),
        args: extendArgs(field.args),
        astNode: field.astNode,
        resolve: field.resolve
      };
    }); // If there are any extensions to the fields, apply those here.

    var extensions = typeExtensionsMap[type.name];

    if (extensions) {
      extensions.forEach(function (extension) {
        extension.fields.forEach(function (field) {
          var fieldName = field.name.value;

          if (oldFieldMap[fieldName]) {
            throw new _GraphQLError.GraphQLError("Field \"".concat(type.name, ".").concat(fieldName, "\" already exists in the ") + 'schema. It cannot also be defined in this type extension.', [field]);
          }

          newFieldMap[fieldName] = astBuilder.buildField(field);
        });
      });
    }

    return newFieldMap;
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

function checkExtensionNode(type, node) {
  switch (node.kind) {
    case _kinds.Kind.OBJECT_TYPE_EXTENSION:
      if (!(0, _definition.isObjectType)(type)) {
        throw new _GraphQLError.GraphQLError("Cannot extend non-object type \"".concat(type.name, "\"."), [node]);
      }

      break;

    case _kinds.Kind.INTERFACE_TYPE_EXTENSION:
      if (!(0, _definition.isInterfaceType)(type)) {
        throw new _GraphQLError.GraphQLError("Cannot extend non-interface type \"".concat(type.name, "\"."), [node]);
      }

      break;

    case _kinds.Kind.ENUM_TYPE_EXTENSION:
      if (!(0, _definition.isEnumType)(type)) {
        throw new _GraphQLError.GraphQLError("Cannot extend non-enum type \"".concat(type.name, "\"."), [node]);
      }

      break;

    case _kinds.Kind.UNION_TYPE_EXTENSION:
      if (!(0, _definition.isUnionType)(type)) {
        throw new _GraphQLError.GraphQLError("Cannot extend non-union type \"".concat(type.name, "\"."), [node]);
      }

      break;

    case _kinds.Kind.INPUT_OBJECT_TYPE_EXTENSION:
      if (!(0, _definition.isInputObjectType)(type)) {
        throw new _GraphQLError.GraphQLError("Cannot extend non-input object type \"".concat(type.name, "\"."), [node]);
      }

      break;
  }
}