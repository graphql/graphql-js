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
import { ASTDefinitionBuilder } from './buildASTSchema';
import { assertValidSDLExtension } from '../validation/validate';
import { assertSchema, GraphQLSchema } from '../type/schema';
import { isIntrospectionType } from '../type/introspection';
import { isSpecifiedScalarType } from '../type/scalars';

import type { GraphQLSchemaValidationOptions } from '../type/schema';
import type { GraphQLType, GraphQLNamedType } from '../type/definition';

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
  const schemaConfig = schema.toConfig();

  // Get the extended root operation types.
  const operationTypes = {
    query: extendMaybeNamedType(schemaConfig.query),
    mutation: extendMaybeNamedType(schemaConfig.mutation),
    subscription: extendMaybeNamedType(schemaConfig.subscription),
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

  const schemaTypes = [
    // Iterate through all types, getting the type definition for each, ensuring
    // that any type not directly referenced by a field will get created.
    ...schemaConfig.types.map(type => extendNamedType(type)),
    // Do the same with new types.
    ...objectValues(typeDefinitionMap).map(type => astBuilder.buildType(type)),
  ];

  // Support both original legacy names and extended legacy names.
  const allowedLegacyNames = schemaConfig.allowedLegacyNames.concat(
    (options && options.allowedLegacyNames) || [],
  );

  // Then produce and return a Schema with these types.
  return new GraphQLSchema({
    ...operationTypes,
    types: schemaTypes,
    directives: getMergedDirectives(),
    astNode: schemaConfig.astNode,
    extensionASTNodes: schemaConfig.extensionASTNodes.concat(schemaExtensions),
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
    const config = directive.toConfig();

    return new GraphQLDirective({
      ...config,
      args: extendArgs(config.args),
    });
  }

  function extendInputObjectType(
    type: GraphQLInputObjectType,
  ): GraphQLInputObjectType {
    const config = type.toConfig();
    const extensionNodes = typeExtensionsMap[config.name] || [];

    return new GraphQLInputObjectType({
      ...config,
      fields: fieldsThunk,
      extensionASTNodes: config.extensionASTNodes.concat(extensionNodes),
    });

    function fieldsThunk() {
      const fields = mapValue(config.fields, field => ({
        ...field,
        type: extendType(field.type),
      }));

      // If there are any extensions to the fields, apply those here.
      for (const extension of extensionNodes) {
        for (const field of extension.fields) {
          fields[field.name.value] = astBuilder.buildInputField(field);
        }
      }
      return fields;
    }
  }

  function extendEnumType(type: GraphQLEnumType): GraphQLEnumType {
    const config = type.toConfig();
    const extensionNodes = typeExtensionsMap[type.name] || [];
    const values = config.values;

    // If there are any extensions to the values, apply those here.
    for (const extension of extensionNodes) {
      for (const value of extension.values) {
        values[value.name.value] = astBuilder.buildEnumValue(value);
      }
    }

    return new GraphQLEnumType({
      ...config,
      values,
      extensionASTNodes: config.extensionASTNodes.concat(extensionNodes),
    });
  }

  function extendScalarType(type: GraphQLScalarType): GraphQLScalarType {
    const config = type.toConfig();
    const extensionNodes = typeExtensionsMap[config.name] || [];

    return new GraphQLScalarType({
      ...config,
      extensionASTNodes: config.extensionASTNodes.concat(extensionNodes),
    });
  }

  function extendObjectType(type: GraphQLObjectType): GraphQLObjectType {
    const config = type.toConfig();
    const extensionNodes = typeExtensionsMap[config.name] || [];

    return new GraphQLObjectType({
      ...config,
      interfaces: interfacesThunk,
      fields: () => extendFieldMap(config),
      extensionASTNodes: config.extensionASTNodes.concat(extensionNodes),
    });

    function interfacesThunk() {
      const interfaces = config.interfaces.map(extendNamedType);

      // If there are any extensions to the interfaces, apply those here.
      for (const extension of extensionNodes) {
        for (const namedType of extension.interfaces) {
          // Note: While this could make early assertions to get the correctly
          // typed values, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable results.
          interfaces.push((astBuilder.buildType(namedType): any));
        }
      }
      return interfaces;
    }
  }

  function extendInterfaceType(
    type: GraphQLInterfaceType,
  ): GraphQLInterfaceType {
    const config = type.toConfig();
    const extensionNodes = typeExtensionsMap[config.name] || [];

    return new GraphQLInterfaceType({
      ...config,
      fields: () => extendFieldMap(config),
      extensionASTNodes: config.extensionASTNodes.concat(extensionNodes),
    });
  }

  function extendUnionType(type: GraphQLUnionType): GraphQLUnionType {
    const config = type.toConfig();
    const extensionNodes = typeExtensionsMap[config.name] || [];

    return new GraphQLUnionType({
      ...config,
      types: typesThunk,
      extensionASTNodes: config.extensionASTNodes.concat(extensionNodes),
    });

    function typesThunk() {
      const types = config.types.map(extendNamedType);

      // If there are any extensions to the union, apply those here.
      for (const extension of extensionNodes) {
        for (const namedType of extension.types) {
          // Note: While this could make early assertions to get the correctly
          // typed values, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable results.
          types.push((astBuilder.buildType(namedType): any));
        }
      }
      return types;
    }
  }

  function extendArgs(oldArgs) {
    return mapValue(oldArgs, arg => ({
      ...arg,
      type: extendType(arg.type),
    }));
  }

  function extendFieldMap(config) {
    const fields = mapValue(config.fields, field => ({
      ...field,
      type: extendType(field.type),
      args: extendArgs(field.args),
    }));

    // If there are any extensions to the fields, apply those here.
    const extensionNodes = typeExtensionsMap[config.name] || [];
    for (const extension of extensionNodes) {
      for (const field of extension.fields) {
        fields[field.name.value] = astBuilder.buildField(field);
      }
    }

    return fields;
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
