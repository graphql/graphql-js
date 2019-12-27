// @flow strict

import objectValues from '../polyfills/objectValues';

import inspect from '../jsutils/inspect';
import mapValue from '../jsutils/mapValue';
import invariant from '../jsutils/invariant';
import devAssert from '../jsutils/devAssert';

import { Kind } from '../language/kinds';
import {
  isTypeDefinitionNode,
  isTypeExtensionNode,
} from '../language/predicates';
import {
  type DocumentNode,
  type DirectiveDefinitionNode,
  type SchemaExtensionNode,
  type SchemaDefinitionNode,
} from '../language/ast';

import { assertValidSDLExtension } from '../validation/validate';

import { GraphQLDirective } from '../type/directives';
import { isSpecifiedScalarType } from '../type/scalars';
import { isIntrospectionType } from '../type/introspection';
import {
  type GraphQLSchemaValidationOptions,
  assertSchema,
  GraphQLSchema,
} from '../type/schema';
import {
  type GraphQLNamedType,
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

import { ASTDefinitionBuilder } from './buildASTSchema';

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

  devAssert(
    documentAST && documentAST.kind === Kind.DOCUMENT,
    'Must provide valid Document AST.',
  );

  if (!options || !(options.assumeValid || options.assumeValidSDL)) {
    assertValidSDLExtension(documentAST, schema);
  }

  // Collect the type definitions and extensions found in the document.
  const typeDefs = [];
  const typeExtensionsMap = Object.create(null);

  // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".
  const directiveDefs: Array<DirectiveDefinitionNode> = [];

  let schemaDef: ?SchemaDefinitionNode;
  // Schema extensions are collected which may add additional operation types.
  const schemaExtensions: Array<SchemaExtensionNode> = [];

  for (const def of documentAST.definitions) {
    if (def.kind === Kind.SCHEMA_DEFINITION) {
      schemaDef = def;
    } else if (def.kind === Kind.SCHEMA_EXTENSION) {
      schemaExtensions.push(def);
    } else if (isTypeDefinitionNode(def)) {
      typeDefs.push(def);
    } else if (isTypeExtensionNode(def)) {
      const extendedTypeName = def.name.value;
      const existingTypeExtensions = typeExtensionsMap[extendedTypeName];
      typeExtensionsMap[extendedTypeName] = existingTypeExtensions
        ? existingTypeExtensions.concat([def])
        : [def];
    } else if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      directiveDefs.push(def);
    }
  }

  // If this document contains no new types, extensions, or directives then
  // return the same unmodified GraphQLSchema instance.
  if (
    Object.keys(typeExtensionsMap).length === 0 &&
    typeDefs.length === 0 &&
    directiveDefs.length === 0 &&
    schemaExtensions.length === 0 &&
    !schemaDef
  ) {
    return schema;
  }

  const astBuilder = new ASTDefinitionBuilder(options, typeName => {
    const type = typeMap[typeName];
    if (type === undefined) {
      throw new Error(`Unknown type: "${typeName}".`);
    }
    return type;
  });

  const typeMap = astBuilder.buildTypeMap(typeDefs, typeExtensionsMap);
  const schemaConfig = schema.toConfig();
  for (const existingType of schemaConfig.types) {
    typeMap[existingType.name] = extendNamedType(existingType);
  }

  const operationTypes = {
    // Get the extended root operation types.
    query: schemaConfig.query && replaceNamedType(schemaConfig.query),
    mutation: schemaConfig.mutation && replaceNamedType(schemaConfig.mutation),
    subscription:
      schemaConfig.subscription && replaceNamedType(schemaConfig.subscription),
    // Then, incorporate schema definition and all schema extensions.
    ...(schemaDef && astBuilder.getOperationTypes([schemaDef])),
    ...astBuilder.getOperationTypes(schemaExtensions),
  };

  // Then produce and return a Schema with these types.
  return new GraphQLSchema({
    ...operationTypes,
    types: objectValues(typeMap),
    directives: [
      ...schemaConfig.directives.map(replaceDirective),
      ...astBuilder.buildDirectives(directiveDefs),
    ],
    astNode: schemaDef || schemaConfig.astNode,
    extensionASTNodes: concatMaybeArrays(
      schemaConfig.extensionASTNodes,
      schemaExtensions,
    ),
  });

  // Below are functions used for producing this schema that have closed over
  // this scope and have access to the schema, cache, and newly defined types.

  function replaceType(type) {
    if (isListType(type)) {
      return new GraphQLList(replaceType(type.ofType));
    } else if (isNonNullType(type)) {
      return new GraphQLNonNull(replaceType(type.ofType));
    }
    return replaceNamedType(type);
  }

  function replaceNamedType<T: GraphQLNamedType>(type: T): T {
    // Note: While this could make early assertions to get the correctly
    // typed values, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    return ((typeMap[type.name]: any): T);
  }

  function replaceDirective(directive: GraphQLDirective): GraphQLDirective {
    const config = directive.toConfig();
    return new GraphQLDirective({
      ...config,
      args: mapValue(config.args, extendArg),
    });
  }

  function extendNamedType(type: GraphQLNamedType): GraphQLNamedType {
    if (isIntrospectionType(type) || isSpecifiedScalarType(type)) {
      // Builtin types are not extended.
      return type;
    } else if (isScalarType(type)) {
      return extendScalarType(type);
    } else if (isObjectType(type)) {
      return extendObjectType(type);
    } else if (isInterfaceType(type)) {
      return extendInterfaceType(type);
    } else if (isUnionType(type)) {
      return extendUnionType(type);
    } else if (isEnumType(type)) {
      return extendEnumType(type);
    } else if (isInputObjectType(type)) {
      return extendInputObjectType(type);
    }

    // Not reachable. All possible types have been considered.
    invariant(false, 'Unexpected type: ' + inspect((type: empty)));
  }

  function extendInputObjectType(
    type: GraphQLInputObjectType,
  ): GraphQLInputObjectType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] || [];

    return new GraphQLInputObjectType({
      ...config,
      fields: () => ({
        ...mapValue(config.fields, field => ({
          ...field,
          type: replaceType(field.type),
        })),
        // $FlowFixMe Bug in Flow, see https://github.com/facebook/flow/issues/8178
        ...astBuilder.buildInputFieldMap(extensions),
      }),
      extensionASTNodes: concatMaybeArrays(
        config.extensionASTNodes,
        extensions,
      ),
    });
  }

  function extendEnumType(type: GraphQLEnumType): GraphQLEnumType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[type.name] || [];

    return new GraphQLEnumType({
      ...config,
      values: {
        ...config.values,
        // $FlowFixMe Bug in Flow, see https://github.com/facebook/flow/issues/8178
        ...astBuilder.buildEnumValueMap(extensions),
      },
      extensionASTNodes: concatMaybeArrays(
        config.extensionASTNodes,
        extensions,
      ),
    });
  }

  function extendScalarType(type: GraphQLScalarType): GraphQLScalarType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] || [];

    return new GraphQLScalarType({
      ...config,
      extensionASTNodes: concatMaybeArrays(
        config.extensionASTNodes,
        extensions,
      ),
    });
  }

  function extendObjectType(type: GraphQLObjectType): GraphQLObjectType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] || [];

    return new GraphQLObjectType({
      ...config,
      interfaces: () => [
        ...type.getInterfaces().map(replaceNamedType),
        ...astBuilder.buildInterfaces(extensions),
      ],
      fields: () => ({
        ...mapValue(config.fields, extendField),
        // $FlowFixMe Bug in Flow, see https://github.com/facebook/flow/issues/8178
        ...astBuilder.buildFieldMap(extensions),
      }),
      extensionASTNodes: concatMaybeArrays(
        config.extensionASTNodes,
        extensions,
      ),
    });
  }

  function extendInterfaceType(
    type: GraphQLInterfaceType,
  ): GraphQLInterfaceType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] || [];

    return new GraphQLInterfaceType({
      ...config,
      interfaces: () => [
        ...type.getInterfaces().map(replaceNamedType),
        ...astBuilder.buildInterfaces(extensions),
      ],
      fields: () => ({
        ...mapValue(config.fields, extendField),
        // $FlowFixMe Bug in Flow, see https://github.com/facebook/flow/issues/8178
        ...astBuilder.buildFieldMap(extensions),
      }),
      extensionASTNodes: concatMaybeArrays(
        config.extensionASTNodes,
        extensions,
      ),
    });
  }

  function extendUnionType(type: GraphQLUnionType): GraphQLUnionType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] || [];

    return new GraphQLUnionType({
      ...config,
      types: () => [
        ...type.getTypes().map(replaceNamedType),
        ...astBuilder.buildUnionTypes(extensions),
      ],
      extensionASTNodes: concatMaybeArrays(
        config.extensionASTNodes,
        extensions,
      ),
    });
  }

  function extendField(field) {
    return {
      ...field,
      type: replaceType(field.type),
      args: mapValue(field.args, extendArg),
    };
  }

  function extendArg(arg) {
    return {
      ...arg,
      type: replaceType(arg.type),
    };
  }
}

function concatMaybeArrays<X>(
  ...arrays: $ReadOnlyArray<?$ReadOnlyArray<X>>
): ?$ReadOnlyArray<X> {
  // eslint-disable-next-line no-undef-init
  let result = undefined;
  for (const maybeArray of arrays) {
    if (maybeArray) {
      result = result === undefined ? maybeArray : result.concat(maybeArray);
    }
  }
  return result;
}
