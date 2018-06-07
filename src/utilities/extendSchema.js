/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import invariant from '../jsutils/invariant';
import keyMap from '../jsutils/keyMap';
import keyValMap from '../jsutils/keyValMap';
import objectValues from '../jsutils/objectValues';
import { ASTDefinitionBuilder } from './buildASTSchema';
import { GraphQLError } from '../error/GraphQLError';
import { isSchema, GraphQLSchema } from '../type/schema';
import { isIntrospectionType } from '../type/introspection';

import type { GraphQLSchemaValidationOptions } from '../type/schema';

import type {
  GraphQLArgument,
  GraphQLFieldConfigArgumentMap,
} from '../type/definition';

import {
  isObjectType,
  isInterfaceType,
  isUnionType,
  isListType,
  isNonNullType,
  isEnumType,
  isInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
} from '../type/definition';

import { GraphQLDirective } from '../type/directives';

import { Kind } from '../language/kinds';

import type { GraphQLType, GraphQLNamedType } from '../type/definition';
import type {
  DocumentNode,
  DirectiveDefinitionNode,
  SchemaExtensionNode,
} from '../language/ast';

type Options = {|
  ...GraphQLSchemaValidationOptions,

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

  // Schema extensions are collected which may add additional operation types.
  const schemaExtensions: Array<SchemaExtensionNode> = [];

  for (let i = 0; i < documentAST.definitions.length; i++) {
    const def = documentAST.definitions[i];
    switch (def.kind) {
      case Kind.SCHEMA_DEFINITION:
        // Sanity check that a schema extension is not defining a new schema
        throw new GraphQLError(
          'Cannot define a new schema within a schema extension.',
          [def],
        );
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
      case Kind.INTERFACE_TYPE_EXTENSION:
      case Kind.ENUM_TYPE_EXTENSION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      case Kind.UNION_TYPE_EXTENSION:
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
        checkExtensionNode(existingType, def);

        const existingTypeExtensions = typeExtensionsMap[extendedTypeName];
        typeExtensionsMap[extendedTypeName] = existingTypeExtensions
          ? existingTypeExtensions.concat([def])
          : [def];
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
    directiveDefinitions.length === 0 &&
    schemaExtensions.length === 0
  ) {
    return schema;
  }

  const astBuilder = new ASTDefinitionBuilder(
    typeDefinitionMap,
    options,
    typeRef => {
      const typeName = typeRef.name.value;
      const existingType = schema.getType(typeName);
      if (existingType) {
        return extendNamedType(existingType);
      }

      throw new GraphQLError(
        `Unknown type: "${typeName}". Ensure that this type exists ` +
          'either in the original schema, or is added in a type definition.',
        [typeRef],
      );
    },
  );

  const extendTypeCache = Object.create(null);

  // Get the extended root operation types.
  const operationTypes = {
    query: extendMaybeNamedType(schema.getQueryType()),
    mutation: extendMaybeNamedType(schema.getMutationType()),
    subscription: extendMaybeNamedType(schema.getSubscriptionType()),
  };

  // Then, incorporate all schema extensions.
  schemaExtensions.forEach(schemaExtension => {
    if (schemaExtension.operationTypes) {
      schemaExtension.operationTypes.forEach(operationType => {
        const operation = operationType.operation;
        if (operationTypes[operation]) {
          throw new Error(`Must provide only one ${operation} type in schema.`);
        }
        const typeRef = operationType.type;
        // Note: While this could make early assertions to get the correctly
        // typed values, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable results.
        operationTypes[operation] = (astBuilder.buildType(typeRef): any);
      });
    }
  });

  const schemaExtensionASTNodes = schemaExtensions
    ? schema.extensionASTNodes
      ? schema.extensionASTNodes.concat(schemaExtensions)
      : schemaExtensions
    : schema.extensionASTNodes;

  const types = [
    // Iterate through all types, getting the type definition for each, ensuring
    // that any type not directly referenced by a field will get created.
    ...objectValues(schema.getTypeMap()).map(type => extendNamedType(type)),
    // Do the same with new types.
    ...astBuilder.buildTypes(objectValues(typeDefinitionMap)),
  ];

  // Support both original legacy names and extended legacy names.
  const allowedLegacyNames = schema.__allowedLegacyNames.concat(
    (options && options.allowedLegacyNames) || [],
  );

  // Then produce and return a Schema with these types.
  return new GraphQLSchema({
    query: operationTypes.query,
    mutation: operationTypes.mutation,
    subscription: operationTypes.subscription,
    types,
    directives: getMergedDirectives(),
    astNode: schema.astNode,
    extensionASTNodes: schemaExtensionASTNodes,
    allowedLegacyNames,
  });

  // Below are functions used for producing this schema that have closed over
  // this scope and have access to the schema, cache, and newly defined types.

  function getMergedDirectives(): Array<GraphQLDirective> {
    const existingDirectives = schema.getDirectives().map(extendDirective);
    invariant(existingDirectives, 'schema must have default directives');

    return existingDirectives.concat(
      directiveDefinitions.map(node => astBuilder.buildDirective(node)),
    );
  }

  function extendMaybeNamedType<T: GraphQLNamedType>(type: ?T): ?T {
    return type ? extendNamedType(type) : null;
  }

  function extendNamedType<T: GraphQLNamedType>(type: T): T {
    if (isIntrospectionType(type)) {
      // Introspection types are not extended.
      return type;
    }

    const name = type.name;
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
    return (extendTypeCache[name]: any);
  }

  function extendDirective(directive: GraphQLDirective): GraphQLDirective {
    return new GraphQLDirective({
      name: directive.name,
      description: directive.description,
      locations: directive.locations,
      args: extendArgs(directive.args),
      astNode: directive.astNode,
    });
  }

  function getExtendedType<T: GraphQLNamedType>(type: T): T {
    if (!extendTypeCache[type.name]) {
      extendTypeCache[type.name] = extendType(type);
    }
    return (extendTypeCache[type.name]: any);
  }

  function extendInputObjectType(
    type: GraphQLInputObjectType,
  ): GraphQLInputObjectType {
    const name = type.name;
    const extensionASTNodes = typeExtensionsMap[name]
      ? type.extensionASTNodes
        ? type.extensionASTNodes.concat(typeExtensionsMap[name])
        : typeExtensionsMap[name]
      : type.extensionASTNodes;
    return new GraphQLInputObjectType({
      name,
      description: type.description,
      fields: () => extendInputFieldMap(type),
      astNode: type.astNode,
      extensionASTNodes,
    });
  }

  function extendInputFieldMap(type: GraphQLInputObjectType) {
    const newFieldMap = Object.create(null);
    const oldFieldMap = type.getFields();
    Object.keys(oldFieldMap).forEach(fieldName => {
      const field = oldFieldMap[fieldName];
      newFieldMap[fieldName] = {
        description: field.description,
        type: extendType(field.type),
        defaultValue: field.defaultValue,
        astNode: field.astNode,
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
          newFieldMap[fieldName] = astBuilder.buildInputField(field);
        });
      });
    }

    return newFieldMap;
  }

  function extendEnumType(type: GraphQLEnumType): GraphQLEnumType {
    const name = type.name;
    const extensionASTNodes = typeExtensionsMap[name]
      ? type.extensionASTNodes
        ? type.extensionASTNodes.concat(typeExtensionsMap[name])
        : typeExtensionsMap[name]
      : type.extensionASTNodes;
    return new GraphQLEnumType({
      name,
      description: type.description,
      values: extendValueMap(type),
      astNode: type.astNode,
      extensionASTNodes,
    });
  }

  function extendValueMap(type: GraphQLEnumType) {
    const newValueMap = Object.create(null);
    const oldValueMap = keyMap(type.getValues(), value => value.name);
    Object.keys(oldValueMap).forEach(valueName => {
      const value = oldValueMap[valueName];
      newValueMap[valueName] = {
        name: value.name,
        description: value.description,
        value: value.value,
        deprecationReason: value.deprecationReason,
        astNode: value.astNode,
      };
    });

    // If there are any extensions to the values, apply those here.
    const extensions = typeExtensionsMap[type.name];
    if (extensions) {
      extensions.forEach(extension => {
        extension.values.forEach(value => {
          const valueName = value.name.value;
          if (oldValueMap[valueName]) {
            throw new GraphQLError(
              `Enum value "${type.name}.${valueName}" already exists in the ` +
                'schema. It cannot also be defined in this type extension.',
              [value],
            );
          }
          newValueMap[valueName] = astBuilder.buildEnumValue(value);
        });
      });
    }

    return newValueMap;
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

  function extendArgs(
    args: Array<GraphQLArgument>,
  ): GraphQLFieldConfigArgumentMap {
    return keyValMap(
      args,
      arg => arg.name,
      arg => ({
        type: extendType(arg.type),
        defaultValue: arg.defaultValue,
        description: arg.description,
        astNode: arg.astNode,
      }),
    );
  }

  function extendInterfaceType(
    type: GraphQLInterfaceType,
  ): GraphQLInterfaceType {
    const name = type.name;
    const extensionASTNodes = typeExtensionsMap[name]
      ? type.extensionASTNodes
        ? type.extensionASTNodes.concat(typeExtensionsMap[name])
        : typeExtensionsMap[name]
      : type.extensionASTNodes;
    return new GraphQLInterfaceType({
      name: type.name,
      description: type.description,
      fields: () => extendFieldMap(type),
      astNode: type.astNode,
      extensionASTNodes,
      resolveType: type.resolveType,
    });
  }

  function extendUnionType(type: GraphQLUnionType): GraphQLUnionType {
    const name = type.name;
    const extensionASTNodes = typeExtensionsMap[name]
      ? type.extensionASTNodes
        ? type.extensionASTNodes.concat(typeExtensionsMap[name])
        : typeExtensionsMap[name]
      : type.extensionASTNodes;
    const unionTypes = type.getTypes().map(getExtendedType);

    // If there are any extensions to the union, apply those here.
    const extensions = typeExtensionsMap[type.name];
    if (extensions) {
      extensions.forEach(extension => {
        extension.types.forEach(namedType => {
          // Note: While this could make early assertions to get the correctly
          // typed values, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable results.
          unionTypes.push((astBuilder.buildType(namedType): any));
        });
      });
    }

    return new GraphQLUnionType({
      name,
      description: type.description,
      types: unionTypes,
      astNode: type.astNode,
      resolveType: type.resolveType,
      extensionASTNodes,
    });
  }

  function extendImplementedInterfaces(
    type: GraphQLObjectType,
  ): Array<GraphQLInterfaceType> {
    const interfaces = type.getInterfaces().map(extendNamedType);

    // If there are any extensions to the interfaces, apply those here.
    const extensions = typeExtensionsMap[type.name];
    if (extensions) {
      extensions.forEach(extension => {
        extension.interfaces.forEach(namedType => {
          // Note: While this could make early assertions to get the correctly
          // typed values, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable results.
          interfaces.push((astBuilder.buildType(namedType): any));
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
        type: extendType(field.type),
        args: extendArgs(field.args),
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
          newFieldMap[fieldName] = astBuilder.buildField(field);
        });
      });
    }

    return newFieldMap;
  }

  function extendType<T: GraphQLType>(typeDef: T): T {
    if (isListType(typeDef)) {
      return (GraphQLList(extendType(typeDef.ofType)): any);
    }
    if (isNonNullType(typeDef)) {
      return (GraphQLNonNull(extendType(typeDef.ofType)): any);
    }
    return extendNamedType(typeDef);
  }
}

function checkExtensionNode(type, node) {
  switch (node.kind) {
    case Kind.OBJECT_TYPE_EXTENSION:
      if (!isObjectType(type)) {
        throw new GraphQLError(
          `Cannot extend non-object type "${type.name}".`,
          [node],
        );
      }
      break;
    case Kind.INTERFACE_TYPE_EXTENSION:
      if (!isInterfaceType(type)) {
        throw new GraphQLError(
          `Cannot extend non-interface type "${type.name}".`,
          [node],
        );
      }
      break;
    case Kind.ENUM_TYPE_EXTENSION:
      if (!isEnumType(type)) {
        throw new GraphQLError(`Cannot extend non-enum type "${type.name}".`, [
          node,
        ]);
      }
      break;
    case Kind.UNION_TYPE_EXTENSION:
      if (!isUnionType(type)) {
        throw new GraphQLError(`Cannot extend non-union type "${type.name}".`, [
          node,
        ]);
      }
      break;
    case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      if (!isInputObjectType(type)) {
        throw new GraphQLError(
          `Cannot extend non-input object type "${type.name}".`,
          [node],
        );
      }
      break;
  }
}
