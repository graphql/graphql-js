/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import invariant from '../jsutils/invariant';
import { ASTDefinitionBuilder } from './buildASTSchema';
import { SchemaTransformer } from './transformSchema';
import { GraphQLError } from '../error/GraphQLError';
import { isSchema, GraphQLSchema } from '../type/schema';
import type { GraphQLSchemaValidationOptions } from '../type/schema';
import {
  isObjectType,
  isInterfaceType,
  GraphQLObjectType,
  GraphQLInterfaceType,
} from '../type/definition';
import { Kind } from '../language/kinds';
import type {
  DocumentNode,
  DirectiveDefinitionNode,
  TypeExtensionNode,
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
        typeExtensionsMap[extendedTypeName] = appendExtensionToTypeExtensions(
          def,
          typeExtensionsMap[extendedTypeName],
        );
        break;
      case Kind.INTERFACE_TYPE_EXTENSION:
        const extendedInterfaceTypeName = def.name.value;
        const existingInterfaceType = schema.getType(extendedInterfaceTypeName);
        if (!existingInterfaceType) {
          throw new GraphQLError(
            `Cannot extend interface "${extendedInterfaceTypeName}" because ` +
              'it does not exist in the existing schema.',
            [def],
          );
        }
        if (!isInterfaceType(existingInterfaceType)) {
          throw new GraphQLError(
            `Cannot extend non-interface type "${extendedInterfaceTypeName}".`,
            [def],
          );
        }
        typeExtensionsMap[
          extendedInterfaceTypeName
        ] = appendExtensionToTypeExtensions(
          def,
          typeExtensionsMap[extendedInterfaceTypeName],
        );
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

  const astBuilder = new ASTDefinitionBuilder(
    typeDefinitionMap,
    options,
    typeRef => {
      invariant(schemaTransformer);
      const typeName = typeRef.name.value;
      const type = schemaTransformer.transformType(typeName);

      if (type) {
        return type;
      }

      throw new GraphQLError(
        `Unknown type: "${typeName}". Ensure that this type exists ` +
          'either in the original schema, or is added in a type definition.',
        [typeRef],
      );
    },
  );

  const schemaTransformer = new SchemaTransformer(schema, {
    Schema(config) {
      const newDirectives = directiveDefinitions.map(node =>
        astBuilder.buildDirective(node),
      );

      const newTypes = [];
      Object.keys(typeDefinitionMap).forEach(typeName => {
        const def = typeDefinitionMap[typeName];
        newTypes.push(astBuilder.buildType(def));
      });
      const extendAllowedLegacyNames = options && options.allowedLegacyNames;

      return new GraphQLSchema({
        ...config,
        types: config.types.concat(newTypes),
        directives: config.directives.concat(newDirectives),
        allowedLegacyNames: extendAllowedLegacyNames
          ? config.allowedLegacyNames.concat(extendAllowedLegacyNames)
          : config.allowedLegacyNames,
      });
    },
    ObjectType(config) {
      const extensions = typeExtensionsMap[config.name] || [];
      return new GraphQLObjectType({
        ...config,
        interfaces: () => extendImplementedInterfaces(config, extensions),
        fields: () => extendFieldMap(config, extensions),
        extensionASTNodes: config.extensionASTNodes.concat(extensions),
      });
    },
    InterfaceType(config) {
      const extensions = typeExtensionsMap[config.name] || [];
      return new GraphQLInterfaceType({
        ...config,
        fields: () => extendFieldMap(config, extensions),
        extensionASTNodes: config.extensionASTNodes.concat(extensions),
      });
    },
  });

  return schemaTransformer.transformSchema();

  function appendExtensionToTypeExtensions(
    extension: TypeExtensionNode,
    existingTypeExtensions: ?Array<TypeExtensionNode>,
  ): Array<TypeExtensionNode> {
    if (!existingTypeExtensions) {
      return [extension];
    }
    existingTypeExtensions.push(extension);
    return existingTypeExtensions;
  }

  function extendImplementedInterfaces(config, extensions) {
    return config.interfaces().concat(
      ...extensions.map(extension =>
        extension.interfaces.map(
          // Note: While this could make early assertions to get the correctly
          // typed values, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable results.
          type => (astBuilder.buildType(type): any),
        ),
      ),
    );
  }

  function extendFieldMap(config, extensions) {
    const oldFields = config.fields();
    const fieldMap = { ...oldFields };

    for (const extension of extensions) {
      for (const field of extension.fields) {
        const fieldName = field.name.value;

        if (oldFields[fieldName]) {
          throw new GraphQLError(
            `Field "${config.name}.${fieldName}" already exists in the ` +
              'schema. It cannot also be defined in this type extension.',
            [field],
          );
        }
        fieldMap[fieldName] = astBuilder.buildField(field);
      }
    }
    return fieldMap;
  }
}
