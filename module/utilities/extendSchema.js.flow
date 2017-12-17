/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import invariant from '../jsutils/invariant';
import keyMap from '../jsutils/keyMap';
import { ASTDefinitionBuilder } from './buildASTSchema';
import { GraphQLError } from '../error/GraphQLError';
import { isSchema, GraphQLSchema } from '../type/schema';

import {
  isObjectType,
  isInterfaceType,
  isUnionType,
  isListType,
  isNonNullType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
} from '../type/definition';
import { GraphQLList, GraphQLNonNull } from '../type/wrappers';

import { GraphQLDirective } from '../type/directives';

import * as Kind from '../language/kinds';

import type { GraphQLType, GraphQLNamedType } from '../type/definition';

import type { DocumentNode, DirectiveDefinitionNode } from '../language/ast';

type Options = {|
  /**
   * When extending a schema with a known valid extension, it might be safe to
   * assume the schema is valid. Set to true to assume the produced schema
   * is valid.
   *
   * Default: false
   */
  assumeValid?: boolean,

  /**
   * Descriptions are defined as preceding string literals, however an older
   * experimental version of the SDL supported preceding comments as
   * descriptions. Set to true to enable this deprecated behavior.
   *
   * Default: false
   */
  commentDescriptions?: boolean,
|};

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
export function extendSchema(
  schema: GraphQLSchema,
  documentAST: DocumentNode,
  options?: Options,
): GraphQLSchema {
  invariant(isSchema(schema), 'Must provide valid GraphQLSchema');

  invariant(
    documentAST && documentAST.kind === Kind.DOCUMENT,
    'Must provide valid Document AST',
  );

  // Collect the type definitions and extensions found in the document.
  const typeDefinitionMap = Object.create(null);
  const typeExtensionsMap = Object.create(null);

  // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".
  const directiveDefinitions: Array<DirectiveDefinitionNode> = [];

  for (let i = 0; i < documentAST.definitions.length; i++) {
    const def = documentAST.definitions[i];
    switch (def.kind) {
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        // Sanity check that none of the defined types conflict with the
        // schema's existing types.
        const typeName = def.name.value;
        if (schema.getType(typeName)) {
          throw new GraphQLError(
            `Type "${typeName}" already exists in the schema. It cannot also ` +
              'be defined in this type definition.',
            [def],
          );
        }
        typeDefinitionMap[typeName] = def;
        break;
      case Kind.OBJECT_TYPE_EXTENSION:
        // Sanity check that this type extension exists within the
        // schema's existing types.
        const extendedTypeName = def.name.value;
        const existingType = schema.getType(extendedTypeName);
        if (!existingType) {
          throw new GraphQLError(
            `Cannot extend type "${extendedTypeName}" because it does not ` +
              'exist in the existing schema.',
            [def],
          );
        }
        if (!isObjectType(existingType)) {
          throw new GraphQLError(
            `Cannot extend non-object type "${extendedTypeName}".`,
            [def],
          );
        }
        let extensions = typeExtensionsMap[extendedTypeName];
        if (extensions) {
          extensions.push(def);
        } else {
          extensions = [def];
        }
        typeExtensionsMap[extendedTypeName] = extensions;
        break;
      case Kind.DIRECTIVE_DEFINITION:
        const directiveName = def.name.value;
        const existingDirective = schema.getDirective(directiveName);
        if (existingDirective) {
          throw new GraphQLError(
            `Directive "${directiveName}" already exists in the schema. It ` +
              'cannot be redefined.',
            [def],
          );
        }
        directiveDefinitions.push(def);
        break;
      case Kind.SCALAR_TYPE_EXTENSION:
      case Kind.INTERFACE_TYPE_EXTENSION:
      case Kind.UNION_TYPE_EXTENSION:
      case Kind.ENUM_TYPE_EXTENSION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION:
        throw new Error(
          `The ${def.kind} kind is not yet supported by extendSchema().`,
        );
    }
  }

  // If this document contains no new types, extensions, or directives then
  // return the same unmodified GraphQLSchema instance.
  if (
    Object.keys(typeExtensionsMap).length === 0 &&
    Object.keys(typeDefinitionMap).length === 0 &&
    directiveDefinitions.length === 0
  ) {
    return schema;
  }

  const definitionBuilder = new ASTDefinitionBuilder(
    typeDefinitionMap,
    options,
    (typeName, node) => {
      const existingType = schema.getType(typeName);
      if (existingType) {
        return extendType(existingType);
      }

      if (node) {
        throw new GraphQLError(
          `Unknown type: "${typeName}". Ensure that this type exists ` +
            'either in the original schema, or is added in a type definition.',
          [node],
        );
      }
      throw GraphQLError('Missing type from schema');
    },
  );

  // Get the root Query, Mutation, and Subscription object types.
  // Note: While this could make early assertions to get the correctly
  // typed values below, that would throw immediately while type system
  // validation with validateSchema() will produce more actionable results.
  const existingQueryType = schema.getQueryType();
  const queryType = existingQueryType
    ? (definitionBuilder.buildType(existingQueryType.name): any)
    : null;

  const existingMutationType = schema.getMutationType();
  const mutationType = existingMutationType
    ? (definitionBuilder.buildType(existingMutationType.name): any)
    : null;

  const existingSubscriptionType = schema.getSubscriptionType();
  const subscriptionType = existingSubscriptionType
    ? (definitionBuilder.buildType(existingSubscriptionType.name): any)
    : null;

  // Iterate through all types, getting the type definition for each, ensuring
  // that any type not directly referenced by a field will get created.
  const typeMap = schema.getTypeMap();
  const types = Object.keys(typeMap).map(typeName =>
    definitionBuilder.buildType(typeName),
  );

  // Do the same with new types, appending to the list of defined types.
  Object.keys(typeDefinitionMap).forEach(typeName => {
    types.push(definitionBuilder.buildType(typeName));
  });

  // Then produce and return a Schema with these types.
  return new GraphQLSchema({
    query: queryType,
    mutation: mutationType,
    subscription: subscriptionType,
    types,
    directives: getMergedDirectives(),
    astNode: schema.astNode,
  });

  // Below are functions used for producing this schema that have closed over
  // this scope and have access to the schema, cache, and newly defined types.

  function getMergedDirectives(): Array<GraphQLDirective> {
    const existingDirectives = schema.getDirectives();
    invariant(existingDirectives, 'schema must have default directives');

    const newDirectives = directiveDefinitions.map(directiveNode =>
      definitionBuilder.buildDirective(directiveNode),
    );
    return existingDirectives.concat(newDirectives);
  }

  function getTypeFromDef<T: GraphQLNamedType>(typeDef: T): T {
    const type = definitionBuilder.buildType(typeDef.name);
    return (type: any);
  }

  // Given a type's introspection result, construct the correct
  // GraphQLType instance.
  function extendType(type: GraphQLNamedType): GraphQLNamedType {
    if (isObjectType(type)) {
      return extendObjectType(type);
    }
    if (isInterfaceType(type)) {
      return extendInterfaceType(type);
    }
    if (isUnionType(type)) {
      return extendUnionType(type);
    }
    return type;
  }

  function extendObjectType(type: GraphQLObjectType): GraphQLObjectType {
    const name = type.name;
    const extensionASTNodes = typeExtensionsMap[name]
      ? type.extensionASTNodes
        ? type.extensionASTNodes.concat(typeExtensionsMap[name])
        : typeExtensionsMap[name]
      : type.extensionASTNodes;
    return new GraphQLObjectType({
      name,
      description: type.description,
      interfaces: () => extendImplementedInterfaces(type),
      fields: () => extendFieldMap(type),
      astNode: type.astNode,
      extensionASTNodes,
      isTypeOf: type.isTypeOf,
    });
  }

  function extendInterfaceType(
    type: GraphQLInterfaceType,
  ): GraphQLInterfaceType {
    return new GraphQLInterfaceType({
      name: type.name,
      description: type.description,
      fields: () => extendFieldMap(type),
      astNode: type.astNode,
      resolveType: type.resolveType,
    });
  }

  function extendUnionType(type: GraphQLUnionType): GraphQLUnionType {
    return new GraphQLUnionType({
      name: type.name,
      description: type.description,
      types: type.getTypes().map(getTypeFromDef),
      astNode: type.astNode,
      resolveType: type.resolveType,
    });
  }

  function extendImplementedInterfaces(
    type: GraphQLObjectType,
  ): Array<GraphQLInterfaceType> {
    const interfaces = type.getInterfaces().map(getTypeFromDef);

    // If there are any extensions to the interfaces, apply those here.
    const extensions = typeExtensionsMap[type.name];
    if (extensions) {
      extensions.forEach(extension => {
        extension.interfaces.forEach(namedType => {
          // Note: While this could make early assertions to get the correctly
          // typed values, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable results.
          interfaces.push((definitionBuilder.buildType(namedType): any));
        });
      });
    }

    return interfaces;
  }

  function extendFieldMap(type: GraphQLObjectType | GraphQLInterfaceType) {
    const newFieldMap = Object.create(null);
    const oldFieldMap = type.getFields();
    Object.keys(oldFieldMap).forEach(fieldName => {
      const field = oldFieldMap[fieldName];
      newFieldMap[fieldName] = {
        description: field.description,
        deprecationReason: field.deprecationReason,
        type: extendFieldType(field.type),
        args: keyMap(field.args, arg => arg.name),
        astNode: field.astNode,
        resolve: field.resolve,
      };
    });

    // If there are any extensions to the fields, apply those here.
    const extensions = typeExtensionsMap[type.name];
    if (extensions) {
      extensions.forEach(extension => {
        extension.fields.forEach(field => {
          const fieldName = field.name.value;
          if (oldFieldMap[fieldName]) {
            throw new GraphQLError(
              `Field "${type.name}.${fieldName}" already exists in the ` +
                'schema. It cannot also be defined in this type extension.',
              [field],
            );
          }
          newFieldMap[fieldName] = definitionBuilder.buildField(field);
        });
      });
    }

    return newFieldMap;
  }

  function extendFieldType<T: GraphQLType>(typeDef: T): T {
    if (isListType(typeDef)) {
      return (GraphQLList(extendFieldType(typeDef.ofType)): any);
    }
    if (isNonNullType(typeDef)) {
      return (GraphQLNonNull(extendFieldType(typeDef.ofType)): any);
    }
    return getTypeFromDef(typeDef);
  }
}
