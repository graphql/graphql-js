/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */
import invariant from '../jsutils/invariant';
import keyMap from '../jsutils/keyMap';
import keyValMap from '../jsutils/keyValMap';
import objectValues from '../jsutils/objectValues';
import { ASTDefinitionBuilder } from './buildASTSchema';
import { GraphQLError } from '../error/GraphQLError';
import { isSchema, GraphQLSchema } from '../type/schema';
import { isIntrospectionType } from '../type/introspection';
import { isObjectType, isInterfaceType, isUnionType, isListType, isNonNullType, isEnumType, isInputObjectType, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLInterfaceType, GraphQLUnionType, GraphQLEnumType, GraphQLInputObjectType } from '../type/definition';
import { GraphQLDirective } from '../type/directives';
import { Kind } from '../language/kinds';

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
export function extendSchema(schema, documentAST, options) {
  !isSchema(schema) ? invariant(0, 'Must provide valid GraphQLSchema') : void 0;
  !(documentAST && documentAST.kind === Kind.DOCUMENT) ? invariant(0, 'Must provide valid Document AST') : void 0; // Collect the type definitions and extensions found in the document.

  var typeDefinitionMap = Object.create(null);
  var typeExtensionsMap = Object.create(null); // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".

  var directiveDefinitions = []; // Schema extensions are collected which may add additional operation types.

  var schemaExtensions = [];

  for (var i = 0; i < documentAST.definitions.length; i++) {
    var def = documentAST.definitions[i];

    switch (def.kind) {
      case Kind.SCHEMA_DEFINITION:
        // Sanity check that a schema extension is not defining a new schema
        throw new GraphQLError('Cannot define a new schema within a schema extension.', [def]);

      case Kind.SCHEMA_EXTENSION:
        schemaExtensions.push(def);
        break;

      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        // Sanity check that none of the defined types conflict with the
        // schema's existing types.
        var typeName = def.name.value;

        if (schema.getType(typeName)) {
          throw new GraphQLError("Type \"".concat(typeName, "\" already exists in the schema. It cannot also ") + 'be defined in this type definition.', [def]);
        }

        typeDefinitionMap[typeName] = def;
        break;

      case Kind.OBJECT_TYPE_EXTENSION:
      case Kind.INTERFACE_TYPE_EXTENSION:
      case Kind.ENUM_TYPE_EXTENSION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      case Kind.UNION_TYPE_EXTENSION:
        // Sanity check that this type extension exists within the
        // schema's existing types.
        var extendedTypeName = def.name.value;
        var existingType = schema.getType(extendedTypeName);

        if (!existingType) {
          throw new GraphQLError("Cannot extend type \"".concat(extendedTypeName, "\" because it does not ") + 'exist in the existing schema.', [def]);
        }

        checkExtensionNode(existingType, def);
        var existingTypeExtensions = typeExtensionsMap[extendedTypeName];
        typeExtensionsMap[extendedTypeName] = existingTypeExtensions ? existingTypeExtensions.concat([def]) : [def];
        break;

      case Kind.DIRECTIVE_DEFINITION:
        var directiveName = def.name.value;
        var existingDirective = schema.getDirective(directiveName);

        if (existingDirective) {
          throw new GraphQLError("Directive \"".concat(directiveName, "\" already exists in the schema. It ") + 'cannot be redefined.', [def]);
        }

        directiveDefinitions.push(def);
        break;

      case Kind.SCALAR_TYPE_EXTENSION:
        throw new Error("The ".concat(def.kind, " kind is not yet supported by extendSchema()."));
    }
  } // If this document contains no new types, extensions, or directives then
  // return the same unmodified GraphQLSchema instance.


  if (Object.keys(typeExtensionsMap).length === 0 && Object.keys(typeDefinitionMap).length === 0 && directiveDefinitions.length === 0 && schemaExtensions.length === 0) {
    return schema;
  }

  var astBuilder = new ASTDefinitionBuilder(typeDefinitionMap, options, function (typeRef) {
    var typeName = typeRef.name.value;
    var existingType = schema.getType(typeName);

    if (existingType) {
      return extendNamedType(existingType);
    }

    throw new GraphQLError("Unknown type: \"".concat(typeName, "\". Ensure that this type exists ") + 'either in the original schema, or is added in a type definition.', [typeRef]);
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
  var types = objectValues(schema.getTypeMap()).map(function (type) {
    return extendNamedType(type);
  }).concat(astBuilder.buildTypes(objectValues(typeDefinitionMap))); // Support both original legacy names and extended legacy names.

  var allowedLegacyNames = schema.__allowedLegacyNames.concat(options && options.allowedLegacyNames || []); // Then produce and return a Schema with these types.


  return new GraphQLSchema({
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
    !existingDirectives ? invariant(0, 'schema must have default directives') : void 0;
    return existingDirectives.concat(directiveDefinitions.map(function (node) {
      return astBuilder.buildDirective(node);
    }));
  }

  function extendMaybeNamedType(type) {
    return type ? extendNamedType(type) : null;
  }

  function extendNamedType(type) {
    if (isIntrospectionType(type)) {
      // Introspection types are not extended.
      return type;
    }

    var name = type.name;

    if (!extendTypeCache[name]) {
      if (isObjectType(type)) {
        extendTypeCache[name] = extendObjectType(type);
      } else if (isInterfaceType(type)) {
        extendTypeCache[name] = extendInterfaceType(type);
      } else if (isUnionType(type)) {
        extendTypeCache[name] = extendUnionType(type);
      } else if (isEnumType(type)) {
        extendTypeCache[name] = extendEnumType(type);
      } else if (isInputObjectType(type)) {
        extendTypeCache[name] = extendInputObjectType(type);
      } else {
        // This type is not yet extendable.
        extendTypeCache[name] = type;
      }
    }

    return extendTypeCache[name];
  }

  function extendDirective(directive) {
    return new GraphQLDirective({
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
    return new GraphQLInputObjectType({
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
            throw new GraphQLError("Field \"".concat(type.name, ".").concat(fieldName, "\" already exists in the ") + 'schema. It cannot also be defined in this type extension.', [field]);
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
    return new GraphQLEnumType({
      name: name,
      description: type.description,
      values: extendValueMap(type),
      astNode: type.astNode,
      extensionASTNodes: extensionASTNodes
    });
  }

  function extendValueMap(type) {
    var newValueMap = Object.create(null);
    var oldValueMap = keyMap(type.getValues(), function (value) {
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
            throw new GraphQLError("Enum value \"".concat(type.name, ".").concat(valueName, "\" already exists in the ") + 'schema. It cannot also be defined in this type extension.', [value]);
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
    return new GraphQLObjectType({
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
    return keyValMap(args, function (arg) {
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
    return new GraphQLInterfaceType({
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

    return new GraphQLUnionType({
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
            throw new GraphQLError("Field \"".concat(type.name, ".").concat(fieldName, "\" already exists in the ") + 'schema. It cannot also be defined in this type extension.', [field]);
          }

          newFieldMap[fieldName] = astBuilder.buildField(field);
        });
      });
    }

    return newFieldMap;
  }

  function extendType(typeDef) {
    if (isListType(typeDef)) {
      return GraphQLList(extendType(typeDef.ofType));
    }

    if (isNonNullType(typeDef)) {
      return GraphQLNonNull(extendType(typeDef.ofType));
    }

    return extendNamedType(typeDef);
  }
}

function checkExtensionNode(type, node) {
  switch (node.kind) {
    case Kind.OBJECT_TYPE_EXTENSION:
      if (!isObjectType(type)) {
        throw new GraphQLError("Cannot extend non-object type \"".concat(type.name, "\"."), [node]);
      }

      break;

    case Kind.INTERFACE_TYPE_EXTENSION:
      if (!isInterfaceType(type)) {
        throw new GraphQLError("Cannot extend non-interface type \"".concat(type.name, "\"."), [node]);
      }

      break;

    case Kind.ENUM_TYPE_EXTENSION:
      if (!isEnumType(type)) {
        throw new GraphQLError("Cannot extend non-enum type \"".concat(type.name, "\"."), [node]);
      }

      break;

    case Kind.UNION_TYPE_EXTENSION:
      if (!isUnionType(type)) {
        throw new GraphQLError("Cannot extend non-union type \"".concat(type.name, "\"."), [node]);
      }

      break;

    case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      if (!isInputObjectType(type)) {
        throw new GraphQLError("Cannot extend non-input object type \"".concat(type.name, "\"."), [node]);
      }

      break;
  }
}