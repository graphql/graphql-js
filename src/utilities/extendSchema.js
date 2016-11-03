/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import invariant from '../jsutils/invariant';
import keyMap from '../jsutils/keyMap';
import keyValMap from '../jsutils/keyValMap';
import { getDescription } from './buildASTSchema';
import { valueFromAST } from './valueFromAST';
import { GraphQLError } from '../error/GraphQLError';
import { GraphQLSchema } from '../type/schema';

import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  isInputType,
  isOutputType,
} from '../type/definition';

import {
  GraphQLDirective,
} from '../type/directives';

import {
  __Schema,
  __Directive,
  __DirectiveLocation,
  __Type,
  __Field,
  __InputValue,
  __EnumValue,
  __TypeKind,
} from '../type/introspection';

import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
} from '../type/scalars';

import {
  DOCUMENT,
  LIST_TYPE,
  NON_NULL_TYPE,
  OBJECT_TYPE_DEFINITION,
  INTERFACE_TYPE_DEFINITION,
  ENUM_TYPE_DEFINITION,
  UNION_TYPE_DEFINITION,
  SCALAR_TYPE_DEFINITION,
  INPUT_OBJECT_TYPE_DEFINITION,
  TYPE_EXTENSION_DEFINITION,
  DIRECTIVE_DEFINITION,
} from '../language/kinds';

import type {
  GraphQLType,
  GraphQLNamedType,
  GraphQLInputType,
  GraphQLOutputType,
} from '../type/definition';

import type {
  DirectiveLocationEnum
} from '../type/directives';

import type {
  DocumentNode,
  InputValueDefinitionNode,
  TypeNode,
  NamedTypeNode,
  TypeDefinitionNode,
  ObjectTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  EnumTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  DirectiveDefinitionNode,
} from '../language/ast';


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
export function extendSchema(
  schema: GraphQLSchema,
  documentAST: DocumentNode
): GraphQLSchema {
  invariant(
    schema instanceof GraphQLSchema,
    'Must provide valid GraphQLSchema'
  );

  invariant(
    documentAST && documentAST.kind === DOCUMENT,
    'Must provide valid Document AST'
  );

  // Collect the type definitions and extensions found in the document.
  const typeDefinitionMap = {};
  const typeExtensionsMap = {};

  // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".
  const directiveDefinitions : Array<DirectiveDefinitionNode> = [];

  for (let i = 0; i < documentAST.definitions.length; i++) {
    const def = documentAST.definitions[i];
    switch (def.kind) {
      case OBJECT_TYPE_DEFINITION:
      case INTERFACE_TYPE_DEFINITION:
      case ENUM_TYPE_DEFINITION:
      case UNION_TYPE_DEFINITION:
      case SCALAR_TYPE_DEFINITION:
      case INPUT_OBJECT_TYPE_DEFINITION:
        // Sanity check that none of the defined types conflict with the
        // schema's existing types.
        const typeName = def.name.value;
        if (schema.getType(typeName)) {
          throw new GraphQLError(
            `Type "${typeName}" already exists in the schema. It cannot also ` +
            'be defined in this type definition.',
            [ def ]
          );
        }
        typeDefinitionMap[typeName] = def;
        break;
      case TYPE_EXTENSION_DEFINITION:
        // Sanity check that this type extension exists within the
        // schema's existing types.
        const extendedTypeName = def.definition.name.value;
        const existingType = schema.getType(extendedTypeName);
        if (!existingType) {
          throw new GraphQLError(
            `Cannot extend type "${extendedTypeName}" because it does not ` +
            'exist in the existing schema.',
            [ def.definition ]
          );
        }
        if (!(existingType instanceof GraphQLObjectType)) {
          throw new GraphQLError(
            `Cannot extend non-object type "${extendedTypeName}".`,
            [ def.definition ]
          );
        }
        let extensions = typeExtensionsMap[extendedTypeName];
        if (extensions) {
          extensions.push(def);
        } else {
          extensions = [ def ];
        }
        typeExtensionsMap[extendedTypeName] = extensions;
        break;
      case DIRECTIVE_DEFINITION:
        const directiveName = def.name.value;
        const existingDirective = schema.getDirective(directiveName);
        if (existingDirective) {
          throw new GraphQLError(
            `Directive "${directiveName}" already exists in the schema. It ` +
            'cannot be redefined.',
            [ def ]
          );
        }
        directiveDefinitions.push(def);
        break;
    }
  }

  // If this document contains no new types, extensions, or directives then
  // return the same unmodified GraphQLSchema instance.
  if (Object.keys(typeExtensionsMap).length === 0 &&
      Object.keys(typeDefinitionMap).length === 0 &&
      directiveDefinitions.length === 0) {
    return schema;
  }

  // A cache to use to store the actual GraphQLType definition objects by name.
  // Initialize to the GraphQL built in scalars and introspection types. All
  // functions below are inline so that this type def cache is within the scope
  // of the closure.
  const typeDefCache = {
    String: GraphQLString,
    Int: GraphQLInt,
    Float: GraphQLFloat,
    Boolean: GraphQLBoolean,
    ID: GraphQLID,
    __Schema,
    __Directive,
    __DirectiveLocation,
    __Type,
    __Field,
    __InputValue,
    __EnumValue,
    __TypeKind,
  };

  // Get the root Query, Mutation, and Subscription object types.
  const queryType = getTypeFromDef(schema.getQueryType());

  const existingMutationType = schema.getMutationType();
  const mutationType = existingMutationType ?
    getTypeFromDef(existingMutationType) :
    null;

  const existingSubscriptionType = schema.getSubscriptionType();
  const subscriptionType = existingSubscriptionType ?
    getTypeFromDef(existingSubscriptionType) :
    null;

  // Iterate through all types, getting the type definition for each, ensuring
  // that any type not directly referenced by a field will get created.
  const typeMap = schema.getTypeMap();
  const types = Object.keys(typeMap).map(typeName =>
    getTypeFromDef(typeMap[typeName])
  );

  // Do the same with new types, appending to the list of defined types.
  Object.keys(typeDefinitionMap).forEach(typeName => {
    types.push(getTypeFromAST(typeDefinitionMap[typeName]));
  });

  // Then produce and return a Schema with these types.
  return new GraphQLSchema({
    query: queryType,
    mutation: mutationType,
    subscription: subscriptionType,
    types,
    directives: getMergedDirectives(),
  });

  // Below are functions used for producing this schema that have closed over
  // this scope and have access to the schema, cache, and newly defined types.

  function getMergedDirectives(): Array<GraphQLDirective> {
    const existingDirectives = schema.getDirectives();
    invariant(existingDirectives, 'schema must have default directives');

    const newDirectives = directiveDefinitions.map(directiveNode =>
      getDirective(directiveNode)
    );
    return existingDirectives.concat(newDirectives);
  }

  function getTypeFromDef<T: GraphQLNamedType>(typeDef: T): T {
    const type = _getNamedType(typeDef.name);
    invariant(type, 'Missing type from schema');
    return (type: any);
  }

  function getTypeFromAST(node: NamedTypeNode): GraphQLNamedType {
    const type = _getNamedType(node.name.value);
    if (!type) {
      throw new GraphQLError(
        `Unknown type: "${node.name.value}". Ensure that this type exists ` +
        'either in the original schema, or is added in a type definition.',
        [ node ]
      );
    }
    return type;
  }

  function getObjectTypeFromAST(node: NamedTypeNode): GraphQLObjectType {
    const type = getTypeFromAST(node);
    invariant(type instanceof GraphQLObjectType, 'Must be Object type.');
    return type;
  }

  function getInterfaceTypeFromAST(node: NamedTypeNode): GraphQLInterfaceType {
    const type = getTypeFromAST(node);
    invariant(type instanceof GraphQLInterfaceType, 'Must be Interface type.');
    return type;
  }

  function getInputTypeFromAST(node: NamedTypeNode): GraphQLInputType {
    const type = getTypeFromAST(node);
    invariant(isInputType(type), 'Must be Input type.');
    return (type: any);
  }

  function getOutputTypeFromAST(node: NamedTypeNode): GraphQLOutputType {
    const type = getTypeFromAST(node);
    invariant(isOutputType(type), 'Must be Output type.');
    return (type: any);
  }

  // Given a name, returns a type from either the existing schema or an
  // added type.
  function _getNamedType(typeName: string): ?GraphQLNamedType {
    const cachedTypeDef = typeDefCache[typeName];
    if (cachedTypeDef) {
      return cachedTypeDef;
    }

    const existingType = schema.getType(typeName);
    if (existingType) {
      const typeDef = extendType(existingType);
      typeDefCache[typeName] = typeDef;
      return typeDef;
    }

    const typeNode = typeDefinitionMap[typeName];
    if (typeNode) {
      const typeDef = buildType(typeNode);
      typeDefCache[typeName] = typeDef;
      return typeDef;
    }
  }

  // Given a type's introspection result, construct the correct
  // GraphQLType instance.
  function extendType(type: GraphQLNamedType): GraphQLNamedType {
    if (type instanceof GraphQLObjectType) {
      return extendObjectType(type);
    }
    if (type instanceof GraphQLInterfaceType) {
      return extendInterfaceType(type);
    }
    if (type instanceof GraphQLUnionType) {
      return extendUnionType(type);
    }
    return type;
  }

  function extendObjectType(type: GraphQLObjectType): GraphQLObjectType {
    return new GraphQLObjectType({
      name: type.name,
      description: type.description,
      interfaces: () => extendImplementedInterfaces(type),
      fields: () => extendFieldMap(type),
      isTypeOf: type.isTypeOf,
    });
  }

  function extendInterfaceType(
    type: GraphQLInterfaceType
  ): GraphQLInterfaceType {
    return new GraphQLInterfaceType({
      name: type.name,
      description: type.description,
      fields: () => extendFieldMap(type),
      resolveType: type.resolveType,
    });
  }

  function extendUnionType(type: GraphQLUnionType): GraphQLUnionType {
    return new GraphQLUnionType({
      name: type.name,
      description: type.description,
      types: type.getTypes().map(getTypeFromDef),
      resolveType: type.resolveType,
    });
  }

  function extendImplementedInterfaces(
    type: GraphQLObjectType
  ): Array<GraphQLInterfaceType> {
    const interfaces = type.getInterfaces().map(getTypeFromDef);

    // If there are any extensions to the interfaces, apply those here.
    const extensions = typeExtensionsMap[type.name];
    if (extensions) {
      extensions.forEach(extension => {
        extension.definition.interfaces.forEach(namedType => {
          const interfaceName = namedType.name.value;
          if (interfaces.some(def => def.name === interfaceName)) {
            throw new GraphQLError(
              `Type "${type.name}" already implements "${interfaceName}". ` +
              'It cannot also be implemented in this type extension.',
              [ namedType ]
            );
          }
          interfaces.push(getInterfaceTypeFromAST(namedType));
        });
      });
    }

    return interfaces;
  }

  function extendFieldMap(type: GraphQLObjectType | GraphQLInterfaceType) {
    const newFieldMap = {};
    const oldFieldMap = type.getFields();
    Object.keys(oldFieldMap).forEach(fieldName => {
      const field = oldFieldMap[fieldName];
      newFieldMap[fieldName] = {
        description: field.description,
        deprecationReason: field.deprecationReason,
        type: extendFieldType(field.type),
        args: keyMap(field.args, arg => arg.name),
        resolve: field.resolve,
      };
    });

    // If there are any extensions to the fields, apply those here.
    const extensions = typeExtensionsMap[type.name];
    if (extensions) {
      extensions.forEach(extension => {
        extension.definition.fields.forEach(field => {
          const fieldName = field.name.value;
          if (oldFieldMap[fieldName]) {
            throw new GraphQLError(
              `Field "${type.name}.${fieldName}" already exists in the ` +
              'schema. It cannot also be defined in this type extension.',
              [ field ]
            );
          }
          newFieldMap[fieldName] = {
            description: getDescription(field),
            type: buildOutputFieldType(field.type),
            args: buildInputValues(field.arguments),
          };
        });
      });
    }

    return newFieldMap;
  }

  function extendFieldType<T: GraphQLType>(typeDef: T): T {
    if (typeDef instanceof GraphQLList) {
      return (new GraphQLList(extendFieldType(typeDef.ofType)): any);
    }
    if (typeDef instanceof GraphQLNonNull) {
      return (new GraphQLNonNull(extendFieldType(typeDef.ofType)): any);
    }
    return getTypeFromDef(typeDef);
  }

  function buildType(typeNode: TypeDefinitionNode): GraphQLNamedType {
    switch (typeNode.kind) {
      case OBJECT_TYPE_DEFINITION: return buildObjectType(typeNode);
      case INTERFACE_TYPE_DEFINITION: return buildInterfaceType(typeNode);
      case UNION_TYPE_DEFINITION: return buildUnionType(typeNode);
      case SCALAR_TYPE_DEFINITION: return buildScalarType(typeNode);
      case ENUM_TYPE_DEFINITION: return buildEnumType(typeNode);
      case INPUT_OBJECT_TYPE_DEFINITION: return buildInputObjectType(typeNode);
    }
    throw new TypeError('Unknown type kind ' + typeNode.kind);
  }

  function buildObjectType(typeNode: ObjectTypeDefinitionNode) {
    return new GraphQLObjectType({
      name: typeNode.name.value,
      description: getDescription(typeNode),
      interfaces: () => buildImplementedInterfaces(typeNode),
      fields: () => buildFieldMap(typeNode),
    });
  }

  function buildInterfaceType(typeNode: InterfaceTypeDefinitionNode) {
    return new GraphQLInterfaceType({
      name: typeNode.name.value,
      description: getDescription(typeNode),
      fields: () => buildFieldMap(typeNode),
      resolveType: cannotExecuteExtendedSchema,
    });
  }

  function buildUnionType(typeNode: UnionTypeDefinitionNode) {
    return new GraphQLUnionType({
      name: typeNode.name.value,
      description: getDescription(typeNode),
      types: typeNode.types.map(getObjectTypeFromAST),
      resolveType: cannotExecuteExtendedSchema,
    });
  }

  function buildScalarType(typeNode: ScalarTypeDefinitionNode) {
    return new GraphQLScalarType({
      name: typeNode.name.value,
      description: getDescription(typeNode),
      serialize: id => id,
      // Note: validation calls the parse functions to determine if a
      // literal value is correct. Returning null would cause use of custom
      // scalars to always fail validation. Returning false causes them to
      // always pass validation.
      parseValue: () => false,
      parseLiteral: () => false,
    });
  }

  function buildEnumType(typeNode: EnumTypeDefinitionNode) {
    return new GraphQLEnumType({
      name: typeNode.name.value,
      description: getDescription(typeNode),
      values: keyValMap(typeNode.values, v => v.name.value, () => ({})),
    });
  }

  function buildInputObjectType(typeNode: InputObjectTypeDefinitionNode) {
    return new GraphQLInputObjectType({
      name: typeNode.name.value,
      description: getDescription(typeNode),
      fields: () => buildInputValues(typeNode.fields),
    });
  }

  function getDirective(
    directiveNode: DirectiveDefinitionNode
  ): GraphQLDirective {
    return new GraphQLDirective({
      name: directiveNode.name.value,
      locations: directiveNode.locations.map(
        node => ((node.value: any): DirectiveLocationEnum)
      ),
      args:
        directiveNode.arguments && buildInputValues(directiveNode.arguments),
    });
  }

  function buildImplementedInterfaces(typeNode: ObjectTypeDefinitionNode) {
    return typeNode.interfaces &&
      typeNode.interfaces.map(getInterfaceTypeFromAST);
  }

  function buildFieldMap(typeNode) {
    return keyValMap(
      typeNode.fields,
      field => field.name.value,
      field => ({
        type: buildOutputFieldType(field.type),
        description: getDescription(field),
        args: buildInputValues(field.arguments),
      })
    );
  }

  function buildInputValues(values: Array<InputValueDefinitionNode>) {
    return keyValMap(
      values,
      value => value.name.value,
      value => {
        const type = buildInputFieldType(value.type);
        return {
          type,
          description: getDescription(value),
          defaultValue: valueFromAST(value.defaultValue, type)
        };
      }
    );
  }

  function buildInputFieldType(typeNode: TypeNode): GraphQLInputType {
    if (typeNode.kind === LIST_TYPE) {
      return new GraphQLList(buildInputFieldType(typeNode.type));
    }
    if (typeNode.kind === NON_NULL_TYPE) {
      const nullableType = buildInputFieldType(typeNode.type);
      invariant(!(nullableType instanceof GraphQLNonNull), 'Must be nullable');
      return new GraphQLNonNull(nullableType);
    }
    return getInputTypeFromAST(typeNode);
  }

  function buildOutputFieldType(typeNode: TypeNode): GraphQLOutputType {
    if (typeNode.kind === LIST_TYPE) {
      return new GraphQLList(buildOutputFieldType(typeNode.type));
    }
    if (typeNode.kind === NON_NULL_TYPE) {
      const nullableType = buildOutputFieldType(typeNode.type);
      invariant(!(nullableType instanceof GraphQLNonNull), 'Must be nullable');
      return new GraphQLNonNull(nullableType);
    }
    return getOutputTypeFromAST(typeNode);
  }
}

function cannotExecuteExtendedSchema() {
  throw new Error(
    'Extended Schema cannot use Interface or Union types for execution.'
  );
}
