/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import objectValues from '../polyfills/objectValues';
import invariant from '../jsutils/invariant';
import mapValue from '../jsutils/mapValue';
import keyValMap from '../jsutils/keyValMap';
import { ASTDefinitionBuilder } from './buildASTSchema';
import { assertValidSDLExtension } from '../validation/validate';
import { assertSchema, GraphQLSchema } from '../type/schema';
import { isIntrospectionType } from '../type/introspection';
import { isSpecifiedScalarType } from '../type/scalars';

import type { GraphQLSchemaValidationOptions } from '../type/schema';

import type {
  GraphQLType,
  GraphQLNamedType,
  GraphQLArgument,
  GraphQLFieldConfigArgumentMap,
} from '../type/definition';

import {
  isScalarType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isListType,
  isNonNullType,
  isEnumType,
  isInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
} from '../type/definition';

import { GraphQLDirective } from '../type/directives';

import { Kind } from '../language/kinds';

import type {
  DocumentNode,
  DirectiveDefinitionNode,
  SchemaExtensionNode,
  SchemaDefinitionNode,
} from '../language/ast';
import {
  isTypeDefinitionNode,
  isTypeExtensionNode,
} from '../language/predicates';

type Options = {|
  ...GraphQLSchemaValidationOptions,

  /**
   * Descriptions are defined as preceding string literals, however an older
   * experimental version of the SDL supported preceding comments as
   * descriptions. Set to true to enable this deprecated behavior.
   * This option is provided to ease adoption and will be removed in v16.
   *
   * Default: false
   */
  commentDescriptions?: boolean,

  /**
   * Set to true to assume the SDL is valid.
   *
   * Default: false
   */
  assumeValidSDL?: boolean,
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
  assertSchema(schema);

  invariant(
    documentAST && documentAST.kind === Kind.DOCUMENT,
    'Must provide valid Document AST',
  );

  if (!options || !(options.assumeValid || options.assumeValidSDL)) {
    assertValidSDLExtension(documentAST, schema);
  }

  // Collect the type definitions and extensions found in the document.
  const typeDefinitionMap = Object.create(null);
  const typeExtensionsMap = Object.create(null);

  // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".
  const directiveDefinitions: Array<DirectiveDefinitionNode> = [];

  let schemaDef: ?SchemaDefinitionNode;
  // Schema extensions are collected which may add additional operation types.
  const schemaExtensions: Array<SchemaExtensionNode> = [];

  for (const def of documentAST.definitions) {
    if (def.kind === Kind.SCHEMA_DEFINITION) {
      schemaDef = def;
    } else if (def.kind === Kind.SCHEMA_EXTENSION) {
      schemaExtensions.push(def);
    } else if (isTypeDefinitionNode(def)) {
      const typeName = def.name.value;
      typeDefinitionMap[typeName] = def;
    } else if (isTypeExtensionNode(def)) {
      const extendedTypeName = def.name.value;
      const existingTypeExtensions = typeExtensionsMap[extendedTypeName];
      typeExtensionsMap[extendedTypeName] = existingTypeExtensions
        ? existingTypeExtensions.concat([def])
        : [def];
    } else if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      directiveDefinitions.push(def);
    }
  }

  // If this document contains no new types, extensions, or directives then
  // return the same unmodified GraphQLSchema instance.
  if (
    Object.keys(typeExtensionsMap).length === 0 &&
    Object.keys(typeDefinitionMap).length === 0 &&
    directiveDefinitions.length === 0 &&
    schemaExtensions.length === 0 &&
    !schemaDef
  ) {
    return schema;
  }

  const astBuilder = new ASTDefinitionBuilder(
    typeDefinitionMap,
    options,
    typeName => {
      const existingType = schema.getType(typeName);
      invariant(existingType, `Unknown type: "${typeName}".`);

      return extendNamedType(existingType);
    },
  );

  const extendTypeCache = Object.create(null);

  // Get the extended root operation types.
  const operationTypes = {
    query: extendMaybeNamedType(schema.getQueryType()),
    mutation: extendMaybeNamedType(schema.getMutationType()),
    subscription: extendMaybeNamedType(schema.getSubscriptionType()),
  };

  if (schemaDef) {
    for (const { operation, type } of schemaDef.operationTypes) {
      // Note: While this could make early assertions to get the correctly
      // typed values, that would throw immediately while type system
      // validation with validateSchema() will produce more actionable results.
      operationTypes[operation] = (astBuilder.buildType(type): any);
    }
  }
  // Then, incorporate schema definition and all schema extensions.
  for (const schemaExtension of schemaExtensions) {
    if (schemaExtension.operationTypes) {
      for (const { operation, type } of schemaExtension.operationTypes) {
        // Note: While this could make early assertions to get the correctly
        // typed values, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable results.
        operationTypes[operation] = (astBuilder.buildType(type): any);
      }
    }
  }

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
    ...objectValues(typeDefinitionMap).map(type => astBuilder.buildType(type)),
  ];

  // Support both original legacy names and extended legacy names.
  const allowedLegacyNames = schema.__allowedLegacyNames.concat(
    (options && options.allowedLegacyNames) || [],
  );

  // Then produce and return a Schema with these types.
  return new GraphQLSchema({
    ...operationTypes,
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
    if (isIntrospectionType(type) || isSpecifiedScalarType(type)) {
      // Builtin types are not extended.
      return type;
    }

    const name = type.name;
    if (!extendTypeCache[name]) {
      if (isScalarType(type)) {
        extendTypeCache[name] = extendScalarType(type);
      } else if (isObjectType(type)) {
        extendTypeCache[name] = extendObjectType(type);
      } else if (isInterfaceType(type)) {
        extendTypeCache[name] = extendInterfaceType(type);
      } else if (isUnionType(type)) {
        extendTypeCache[name] = extendUnionType(type);
      } else if (isEnumType(type)) {
        extendTypeCache[name] = extendEnumType(type);
      } else if (isInputObjectType(type)) {
        extendTypeCache[name] = extendInputObjectType(type);
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
    const newFieldMap = mapValue(type.getFields(), field => ({
      description: field.description,
      type: extendType(field.type),
      defaultValue: field.defaultValue,
      astNode: field.astNode,
    }));

    // If there are any extensions to the fields, apply those here.
    const extensions = typeExtensionsMap[type.name];
    if (extensions) {
      for (const extension of extensions) {
        for (const field of extension.fields) {
          newFieldMap[field.name.value] = astBuilder.buildInputField(field);
        }
      }
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
    for (const value of type.getValues()) {
      newValueMap[value.name] = {
        description: value.description,
        value: value.value,
        deprecationReason: value.deprecationReason,
        astNode: value.astNode,
      };
    }

    // If there are any extensions to the values, apply those here.
    const extensions = typeExtensionsMap[type.name];
    if (extensions) {
      for (const extension of extensions) {
        for (const value of extension.values) {
          newValueMap[value.name.value] = astBuilder.buildEnumValue(value);
        }
      }
    }

    return newValueMap;
  }

  function extendScalarType(type: GraphQLScalarType): GraphQLScalarType {
    const name = type.name;
    const extensionASTNodes = typeExtensionsMap[name]
      ? type.extensionASTNodes
        ? type.extensionASTNodes.concat(typeExtensionsMap[name])
        : typeExtensionsMap[name]
      : type.extensionASTNodes;
    return new GraphQLScalarType({
      name,
      description: type.description,
      astNode: type.astNode,
      extensionASTNodes,
      serialize: type.serialize,
      parseValue: type.parseValue,
      parseLiteral: type.parseLiteral,
    });
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
    return new GraphQLUnionType({
      name,
      description: type.description,
      types: () => extendPossibleTypes(type),
      astNode: type.astNode,
      resolveType: type.resolveType,
      extensionASTNodes,
    });
  }

  function extendPossibleTypes(
    type: GraphQLUnionType,
  ): Array<GraphQLObjectType> {
    const possibleTypes = type.getTypes().map(extendNamedType);

    // If there are any extensions to the union, apply those here.
    const extensions = typeExtensionsMap[type.name];
    if (extensions) {
      for (const extension of extensions) {
        for (const namedType of extension.types) {
          // Note: While this could make early assertions to get the correctly
          // typed values, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable results.
          possibleTypes.push((astBuilder.buildType(namedType): any));
        }
      }
    }
    return possibleTypes;
  }

  function extendImplementedInterfaces(
    type: GraphQLObjectType,
  ): Array<GraphQLInterfaceType> {
    const interfaces = type.getInterfaces().map(extendNamedType);

    // If there are any extensions to the interfaces, apply those here.
    const extensions = typeExtensionsMap[type.name];
    if (extensions) {
      for (const extension of extensions) {
        for (const namedType of extension.interfaces) {
          // Note: While this could make early assertions to get the correctly
          // typed values, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable results.
          interfaces.push((astBuilder.buildType(namedType): any));
        }
      }
    }

    return interfaces;
  }

  function extendFieldMap(type: GraphQLObjectType | GraphQLInterfaceType) {
    const newFieldMap = mapValue(type.getFields(), field => ({
      description: field.description,
      deprecationReason: field.deprecationReason,
      type: extendType(field.type),
      args: extendArgs(field.args),
      astNode: field.astNode,
      resolve: field.resolve,
    }));

    // If there are any extensions to the fields, apply those here.
    const extensions = typeExtensionsMap[type.name];
    if (extensions) {
      for (const extension of extensions) {
        for (const field of extension.fields) {
          newFieldMap[field.name.value] = astBuilder.buildField(field);
        }
      }
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
