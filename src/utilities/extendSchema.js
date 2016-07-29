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
  Document,
  InputValueDefinition,
  Type,
  NamedType,
  TypeDefinition,
  ObjectTypeDefinition,
  InterfaceTypeDefinition,
  UnionTypeDefinition,
  ScalarTypeDefinition,
  EnumTypeDefinition,
  InputObjectTypeDefinition,
  DirectiveDefinition,
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
  documentAST: Document
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
  const directiveDefinitions : Array<DirectiveDefinition> = [];

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

    const newDirectives = directiveDefinitions.map(directiveAST =>
      getDirective(directiveAST)
    );
    return existingDirectives.concat(newDirectives);
  }

  function getTypeFromDef<T: GraphQLNamedType>(typeDef: T): T {
    const type = _getNamedType(typeDef.name);
    invariant(type, 'Missing type from schema');
    return (type: any);
  }

  function getTypeFromAST(astNode: NamedType): GraphQLNamedType {
    const type = _getNamedType(astNode.name.value);
    if (!type) {
      throw new GraphQLError(
        `Unknown type: "${astNode.name.value}". Ensure that this type exists ` +
        'either in the original schema, or is added in a type definition.',
        [ astNode ]
      );
    }
    return type;
  }

  function getObjectTypeFromAST(astNode: NamedType): GraphQLObjectType {
    const type = getTypeFromAST(astNode);
    invariant(type instanceof GraphQLObjectType, 'Must be Object type.');
    return type;
  }

  function getInterfaceTypeFromAST(astNode: NamedType): GraphQLInterfaceType {
    const type = getTypeFromAST(astNode);
    invariant(type instanceof GraphQLInterfaceType, 'Must be Interface type.');
    return type;
  }

  function getInputTypeFromAST(astNode: NamedType): GraphQLInputType {
    const type = getTypeFromAST(astNode);
    invariant(isInputType(type), 'Must be Input type.');
    return (type: any);
  }

  function getOutputTypeFromAST(astNode: NamedType): GraphQLOutputType {
    const type = getTypeFromAST(astNode);
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

    const typeAST = typeDefinitionMap[typeName];
    if (typeAST) {
      const typeDef = buildType(typeAST);
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
    });
  }

  function extendInterfaceType(
    type: GraphQLInterfaceType
  ): GraphQLInterfaceType {
    return new GraphQLInterfaceType({
      name: type.name,
      description: type.description,
      fields: () => extendFieldMap(type),
      resolveType: cannotExecuteClientSchema,
    });
  }

  function extendUnionType(type: GraphQLUnionType): GraphQLUnionType {
    return new GraphQLUnionType({
      name: type.name,
      description: type.description,
      types: type.getTypes().map(getTypeFromDef),
      resolveType: cannotExecuteClientSchema,
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
        resolve: cannotExecuteClientSchema,
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
            type: buildOutputFieldType(field.type),
            args: buildInputValues(field.arguments),
            resolve: cannotExecuteClientSchema,
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

  function buildType(typeAST: TypeDefinition): GraphQLNamedType {
    switch (typeAST.kind) {
      case OBJECT_TYPE_DEFINITION: return buildObjectType(typeAST);
      case INTERFACE_TYPE_DEFINITION: return buildInterfaceType(typeAST);
      case UNION_TYPE_DEFINITION: return buildUnionType(typeAST);
      case SCALAR_TYPE_DEFINITION: return buildScalarType(typeAST);
      case ENUM_TYPE_DEFINITION: return buildEnumType(typeAST);
      case INPUT_OBJECT_TYPE_DEFINITION: return buildInputObjectType(typeAST);
    }
    throw new TypeError('Unknown type kind ' + typeAST.kind);
  }

  function buildObjectType(typeAST: ObjectTypeDefinition): GraphQLObjectType {
    return new GraphQLObjectType({
      name: typeAST.name.value,
      interfaces: () => buildImplementedInterfaces(typeAST),
      fields: () => buildFieldMap(typeAST),
    });
  }

  function buildInterfaceType(typeAST: InterfaceTypeDefinition) {
    return new GraphQLInterfaceType({
      name: typeAST.name.value,
      fields: () => buildFieldMap(typeAST),
      resolveType: cannotExecuteClientSchema,
    });
  }

  function buildUnionType(typeAST: UnionTypeDefinition) {
    return new GraphQLUnionType({
      name: typeAST.name.value,
      types: typeAST.types.map(getObjectTypeFromAST),
      resolveType: cannotExecuteClientSchema,
    });
  }

  function buildScalarType(typeAST: ScalarTypeDefinition) {
    return new GraphQLScalarType({
      name: typeAST.name.value,
      serialize: () => null,
      // Note: validation calls the parse functions to determine if a
      // literal value is correct. Returning null would cause use of custom
      // scalars to always fail validation. Returning false causes them to
      // always pass validation.
      parseValue: () => false,
      parseLiteral: () => false,
    });
  }

  function buildEnumType(typeAST: EnumTypeDefinition) {
    return new GraphQLEnumType({
      name: typeAST.name.value,
      values: keyValMap(typeAST.values, v => v.name.value, () => ({})),
    });
  }

  function buildInputObjectType(typeAST: InputObjectTypeDefinition) {
    return new GraphQLInputObjectType({
      name: typeAST.name.value,
      fields: () => buildInputValues(typeAST.fields),
    });
  }

  function getDirective(
    directiveAST: DirectiveDefinition
  ): GraphQLDirective {
    return new GraphQLDirective({
      name: directiveAST.name.value,
      locations: directiveAST.locations.map(
        node => ((node.value: any): DirectiveLocationEnum)
      ),
      args: directiveAST.arguments && buildInputValues(directiveAST.arguments),
    });
  }

  function buildImplementedInterfaces(typeAST: ObjectTypeDefinition) {
    return typeAST.interfaces &&
      typeAST.interfaces.map(getInterfaceTypeFromAST);
  }

  function buildFieldMap(typeAST) {
    return keyValMap(
      typeAST.fields,
      field => field.name.value,
      field => ({
        type: buildOutputFieldType(field.type),
        args: buildInputValues(field.arguments),
        resolve: cannotExecuteClientSchema,
      })
    );
  }

  function buildInputValues(values: Array<InputValueDefinition>) {
    return keyValMap(
      values,
      value => value.name.value,
      value => {
        const type = buildInputFieldType(value.type);
        return {
          type,
          defaultValue: valueFromAST(value.defaultValue, type)
        };
      }
    );
  }

  function buildInputFieldType(typeAST: Type): GraphQLInputType {
    if (typeAST.kind === LIST_TYPE) {
      return new GraphQLList(buildInputFieldType(typeAST.type));
    }
    if (typeAST.kind === NON_NULL_TYPE) {
      const nullableType = buildInputFieldType(typeAST.type);
      invariant(!(nullableType instanceof GraphQLNonNull), 'Must be nullable');
      return new GraphQLNonNull(nullableType);
    }
    return getInputTypeFromAST(typeAST);
  }

  function buildOutputFieldType(typeAST: Type): GraphQLOutputType {
    if (typeAST.kind === LIST_TYPE) {
      return new GraphQLList(buildOutputFieldType(typeAST.type));
    }
    if (typeAST.kind === NON_NULL_TYPE) {
      const nullableType = buildOutputFieldType(typeAST.type);
      invariant(!(nullableType instanceof GraphQLNonNull), 'Must be nullable');
      return new GraphQLNonNull(nullableType);
    }
    return getOutputTypeFromAST(typeAST);
  }
}

function cannotExecuteClientSchema() {
  throw new Error('Client Schema cannot be used for execution.');
}
