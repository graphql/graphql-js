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
import objectValues from '../jsutils/objectValues';
import { ASTDefinitionBuilder } from './buildASTSchema';
import { GraphQLError } from '../error/GraphQLError';
import { isSchema, GraphQLSchema } from '../type/schema';
import { isIntrospectionType } from '../type/introspection';

import { isObjectType, isInterfaceType, isUnionType, isListType, isNonNullType, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLInterfaceType, GraphQLUnionType } from '../type/definition';

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

  !(documentAST && documentAST.kind === Kind.DOCUMENT) ? invariant(0, 'Must provide valid Document AST') : void 0;

  // Collect the type definitions and extensions found in the document.
  var typeDefinitionMap = Object.create(null);
  var typeExtensionsMap = Object.create(null);

  // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".
  var directiveDefinitions = [];

  for (var i = 0; i < documentAST.definitions.length; i++) {
    var def = documentAST.definitions[i];
    switch (def.kind) {
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
          throw new GraphQLError('Type "' + typeName + '" already exists in the schema. It cannot also ' + 'be defined in this type definition.', [def]);
        }
        typeDefinitionMap[typeName] = def;
        break;
      case Kind.OBJECT_TYPE_EXTENSION:
      case Kind.INTERFACE_TYPE_EXTENSION:
        // Sanity check that this type extension exists within the
        // schema's existing types.
        var extendedTypeName = def.name.value;
        var existingType = schema.getType(extendedTypeName);
        if (!existingType) {
          throw new GraphQLError('Cannot extend type "' + extendedTypeName + '" because it does not ' + 'exist in the existing schema.', [def]);
        }
        checkExtensionNode(existingType, def);

        var existingTypeExtensions = typeExtensionsMap[extendedTypeName];
        typeExtensionsMap[extendedTypeName] = existingTypeExtensions ? existingTypeExtensions.concat([def]) : [def];
        break;
      case Kind.DIRECTIVE_DEFINITION:
        var directiveName = def.name.value;
        var existingDirective = schema.getDirective(directiveName);
        if (existingDirective) {
          throw new GraphQLError('Directive "' + directiveName + '" already exists in the schema. It ' + 'cannot be redefined.', [def]);
        }
        directiveDefinitions.push(def);
        break;
      case Kind.SCALAR_TYPE_EXTENSION:
      case Kind.UNION_TYPE_EXTENSION:
      case Kind.ENUM_TYPE_EXTENSION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION:
        throw new Error('The ' + def.kind + ' kind is not yet supported by extendSchema().');
    }
  }

  // If this document contains no new types, extensions, or directives then
  // return the same unmodified GraphQLSchema instance.
  if (Object.keys(typeExtensionsMap).length === 0 && Object.keys(typeDefinitionMap).length === 0 && directiveDefinitions.length === 0) {
    return schema;
  }

  var astBuilder = new ASTDefinitionBuilder(typeDefinitionMap, options, function (typeRef) {
    var typeName = typeRef.name.value;
    var existingType = schema.getType(typeName);
    if (existingType) {
      return getExtendedType(existingType);
    }

    throw new GraphQLError('Unknown type: "' + typeName + '". Ensure that this type exists ' + 'either in the original schema, or is added in a type definition.', [typeRef]);
  });

  var extendTypeCache = Object.create(null);

  // Get the root Query, Mutation, and Subscription object types.
  var existingQueryType = schema.getQueryType();
  var queryType = existingQueryType ? getExtendedType(existingQueryType) : null;

  var existingMutationType = schema.getMutationType();
  var mutationType = existingMutationType ? getExtendedType(existingMutationType) : null;

  var existingSubscriptionType = schema.getSubscriptionType();
  var subscriptionType = existingSubscriptionType ? getExtendedType(existingSubscriptionType) : null;

  var types = [].concat(objectValues(schema.getTypeMap()).map(function (type) {
    return getExtendedType(type);
  }), astBuilder.buildTypes(objectValues(typeDefinitionMap)));

  // Support both original legacy names and extended legacy names.
  var schemaAllowedLegacyNames = schema.__allowedLegacyNames;
  var extendAllowedLegacyNames = options && options.allowedLegacyNames;
  var allowedLegacyNames = schemaAllowedLegacyNames && extendAllowedLegacyNames ? schemaAllowedLegacyNames.concat(extendAllowedLegacyNames) : schemaAllowedLegacyNames || extendAllowedLegacyNames;

  // Then produce and return a Schema with these types.
  return new GraphQLSchema({
    query: queryType,
    mutation: mutationType,
    subscription: subscriptionType,
    types: types,
    directives: getMergedDirectives(),
    astNode: schema.astNode,
    allowedLegacyNames: allowedLegacyNames
  });

  // Below are functions used for producing this schema that have closed over
  // this scope and have access to the schema, cache, and newly defined types.

  function getMergedDirectives() {
    var existingDirectives = schema.getDirectives();
    !existingDirectives ? invariant(0, 'schema must have default directives') : void 0;

    return existingDirectives.concat(directiveDefinitions.map(function (node) {
      return astBuilder.buildDirective(node);
    }));
  }

  function getExtendedType(type) {
    if (!extendTypeCache[type.name]) {
      extendTypeCache[type.name] = extendType(type);
    }
    return extendTypeCache[type.name];
  }

  // To be called at most once per type. Only getExtendedType should call this.
  function extendType(type) {
    if (isIntrospectionType(type)) {
      // Introspection types are not extended.
      return type;
    }
    if (isObjectType(type)) {
      return extendObjectType(type);
    }
    if (isInterfaceType(type)) {
      return extendInterfaceType(type);
    }
    if (isUnionType(type)) {
      return extendUnionType(type);
    }
    // This type is not yet extendable.
    return type;
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
    return new GraphQLUnionType({
      name: type.name,
      description: type.description,
      types: type.getTypes().map(getExtendedType),
      astNode: type.astNode,
      resolveType: type.resolveType
    });
  }

  function extendImplementedInterfaces(type) {
    var interfaces = type.getInterfaces().map(getExtendedType);

    // If there are any extensions to the interfaces, apply those here.
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
        type: extendFieldType(field.type),
        args: keyMap(field.args, function (arg) {
          return arg.name;
        }),
        astNode: field.astNode,
        resolve: field.resolve
      };
    });

    // If there are any extensions to the fields, apply those here.
    var extensions = typeExtensionsMap[type.name];
    if (extensions) {
      extensions.forEach(function (extension) {
        extension.fields.forEach(function (field) {
          var fieldName = field.name.value;
          if (oldFieldMap[fieldName]) {
            throw new GraphQLError('Field "' + type.name + '.' + fieldName + '" already exists in the ' + 'schema. It cannot also be defined in this type extension.', [field]);
          }
          newFieldMap[fieldName] = astBuilder.buildField(field);
        });
      });
    }

    return newFieldMap;
  }

  function extendFieldType(typeDef) {
    if (isListType(typeDef)) {
      return GraphQLList(extendFieldType(typeDef.ofType));
    }
    if (isNonNullType(typeDef)) {
      return GraphQLNonNull(extendFieldType(typeDef.ofType));
    }
    return getExtendedType(typeDef);
  }
}

function checkExtensionNode(type, node) {
  switch (node.kind) {
    case Kind.OBJECT_TYPE_EXTENSION:
      if (!isObjectType(type)) {
        throw new GraphQLError('Cannot extend non-object type "' + type.name + '".', [node]);
      }
      break;
    case Kind.INTERFACE_TYPE_EXTENSION:
      if (!isInterfaceType(type)) {
        throw new GraphQLError('Cannot extend non-interface type "' + type.name + '".', [node]);
      }
      break;
  }
}