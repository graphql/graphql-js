'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.extendSchemaImpl = exports.extendSchema = void 0;
const AccumulatorMap_js_1 = require('../jsutils/AccumulatorMap.js');
const inspect_js_1 = require('../jsutils/inspect.js');
const invariant_js_1 = require('../jsutils/invariant.js');
const mapValue_js_1 = require('../jsutils/mapValue.js');
const kinds_js_1 = require('../language/kinds.js');
const definition_js_1 = require('../type/definition.js');
const directives_js_1 = require('../type/directives.js');
const introspection_js_1 = require('../type/introspection.js');
const scalars_js_1 = require('../type/scalars.js');
const schema_js_1 = require('../type/schema.js');
const validate_js_1 = require('../validation/validate.js');
const values_js_1 = require('../execution/values.js');
const valueFromAST_js_1 = require('./valueFromAST.js');
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
function extendSchema(schema, documentAST, options) {
  (0, schema_js_1.assertSchema)(schema);
  if (options?.assumeValid !== true && options?.assumeValidSDL !== true) {
    (0, validate_js_1.assertValidSDLExtension)(documentAST, schema);
  }
  const schemaConfig = schema.toConfig();
  const extendedConfig = extendSchemaImpl(schemaConfig, documentAST, options);
  return schemaConfig === extendedConfig
    ? schema
    : new schema_js_1.GraphQLSchema(extendedConfig);
}
exports.extendSchema = extendSchema;
/**
 * @internal
 */
function extendSchemaImpl(schemaConfig, documentAST, options) {
  // Collect the type definitions and extensions found in the document.
  const typeDefs = [];
  const scalarExtensions = new AccumulatorMap_js_1.AccumulatorMap();
  const objectExtensions = new AccumulatorMap_js_1.AccumulatorMap();
  const interfaceExtensions = new AccumulatorMap_js_1.AccumulatorMap();
  const unionExtensions = new AccumulatorMap_js_1.AccumulatorMap();
  const enumExtensions = new AccumulatorMap_js_1.AccumulatorMap();
  const inputObjectExtensions = new AccumulatorMap_js_1.AccumulatorMap();
  // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".
  const directiveDefs = [];
  let schemaDef;
  // Schema extensions are collected which may add additional operation types.
  const schemaExtensions = [];
  let isSchemaChanged = false;
  for (const def of documentAST.definitions) {
    switch (def.kind) {
      case kinds_js_1.Kind.SCHEMA_DEFINITION:
        schemaDef = def;
        break;
      case kinds_js_1.Kind.SCHEMA_EXTENSION:
        schemaExtensions.push(def);
        break;
      case kinds_js_1.Kind.DIRECTIVE_DEFINITION:
        directiveDefs.push(def);
        break;
      // Type Definitions
      case kinds_js_1.Kind.SCALAR_TYPE_DEFINITION:
      case kinds_js_1.Kind.OBJECT_TYPE_DEFINITION:
      case kinds_js_1.Kind.INTERFACE_TYPE_DEFINITION:
      case kinds_js_1.Kind.UNION_TYPE_DEFINITION:
      case kinds_js_1.Kind.ENUM_TYPE_DEFINITION:
      case kinds_js_1.Kind.INPUT_OBJECT_TYPE_DEFINITION:
        typeDefs.push(def);
        break;
      // Type System Extensions
      case kinds_js_1.Kind.SCALAR_TYPE_EXTENSION:
        scalarExtensions.add(def.name.value, def);
        break;
      case kinds_js_1.Kind.OBJECT_TYPE_EXTENSION:
        objectExtensions.add(def.name.value, def);
        break;
      case kinds_js_1.Kind.INTERFACE_TYPE_EXTENSION:
        interfaceExtensions.add(def.name.value, def);
        break;
      case kinds_js_1.Kind.UNION_TYPE_EXTENSION:
        unionExtensions.add(def.name.value, def);
        break;
      case kinds_js_1.Kind.ENUM_TYPE_EXTENSION:
        enumExtensions.add(def.name.value, def);
        break;
      case kinds_js_1.Kind.INPUT_OBJECT_TYPE_EXTENSION:
        inputObjectExtensions.add(def.name.value, def);
        break;
      default:
        continue;
    }
    isSchemaChanged = true;
  }
  // If this document contains no new types, extensions, or directives then
  // return the same unmodified GraphQLSchema instance.
  if (!isSchemaChanged) {
    return schemaConfig;
  }
  const typeMap = new Map(
    schemaConfig.types.map((type) => [type.name, extendNamedType(type)]),
  );
  for (const typeNode of typeDefs) {
    const name = typeNode.name.value;
    typeMap.set(name, stdTypeMap.get(name) ?? buildType(typeNode));
  }
  const operationTypes = {
    // Get the extended root operation types.
    query: schemaConfig.query && replaceNamedType(schemaConfig.query),
    mutation: schemaConfig.mutation && replaceNamedType(schemaConfig.mutation),
    subscription:
      schemaConfig.subscription && replaceNamedType(schemaConfig.subscription),
    // Then, incorporate schema definition and all schema extensions.
    ...(schemaDef && getOperationTypes([schemaDef])),
    ...getOperationTypes(schemaExtensions),
  };
  // Then produce and return a Schema config with these types.
  return {
    description: schemaDef?.description?.value ?? schemaConfig.description,
    ...operationTypes,
    types: Array.from(typeMap.values()),
    directives: [
      ...schemaConfig.directives.map(replaceDirective),
      ...directiveDefs.map(buildDirective),
    ],
    extensions: schemaConfig.extensions,
    astNode: schemaDef ?? schemaConfig.astNode,
    extensionASTNodes: schemaConfig.extensionASTNodes.concat(schemaExtensions),
    assumeValid: options?.assumeValid ?? false,
  };
  // Below are functions used for producing this schema that have closed over
  // this scope and have access to the schema, cache, and newly defined types.
  function replaceType(type) {
    if ((0, definition_js_1.isListType)(type)) {
      // @ts-expect-error
      return new definition_js_1.GraphQLList(replaceType(type.ofType));
    }
    if ((0, definition_js_1.isNonNullType)(type)) {
      // @ts-expect-error
      return new definition_js_1.GraphQLNonNull(replaceType(type.ofType));
    }
    // @ts-expect-error FIXME
    return replaceNamedType(type);
  }
  function replaceNamedType(type) {
    // Note: While this could make early assertions to get the correctly
    // typed values, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    return typeMap.get(type.name);
  }
  function replaceDirective(directive) {
    if ((0, directives_js_1.isSpecifiedDirective)(directive)) {
      // Builtin directives are not extended.
      return directive;
    }
    const config = directive.toConfig();
    return new directives_js_1.GraphQLDirective({
      ...config,
      args: (0, mapValue_js_1.mapValue)(config.args, extendArg),
    });
  }
  function extendNamedType(type) {
    if (
      (0, introspection_js_1.isIntrospectionType)(type) ||
      (0, scalars_js_1.isSpecifiedScalarType)(type)
    ) {
      // Builtin types are not extended.
      return type;
    }
    if ((0, definition_js_1.isScalarType)(type)) {
      return extendScalarType(type);
    }
    if ((0, definition_js_1.isObjectType)(type)) {
      return extendObjectType(type);
    }
    if ((0, definition_js_1.isInterfaceType)(type)) {
      return extendInterfaceType(type);
    }
    if ((0, definition_js_1.isUnionType)(type)) {
      return extendUnionType(type);
    }
    if ((0, definition_js_1.isEnumType)(type)) {
      return extendEnumType(type);
    }
    if ((0, definition_js_1.isInputObjectType)(type)) {
      return extendInputObjectType(type);
    }
    /* c8 ignore next 3 */
    // Not reachable, all possible type definition nodes have been considered.
    false ||
      (0, invariant_js_1.invariant)(
        false,
        'Unexpected type: ' + (0, inspect_js_1.inspect)(type),
      );
  }
  function extendInputObjectType(type) {
    const config = type.toConfig();
    const extensions = inputObjectExtensions.get(config.name) ?? [];
    return new definition_js_1.GraphQLInputObjectType({
      ...config,
      fields: () => ({
        ...(0, mapValue_js_1.mapValue)(config.fields, (field) => ({
          ...field,
          type: replaceType(field.type),
        })),
        ...buildInputFieldMap(extensions),
      }),
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }
  function extendEnumType(type) {
    const config = type.toConfig();
    const extensions = enumExtensions.get(type.name) ?? [];
    return new definition_js_1.GraphQLEnumType({
      ...config,
      values: {
        ...config.values,
        ...buildEnumValueMap(extensions),
      },
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }
  function extendScalarType(type) {
    const config = type.toConfig();
    const extensions = scalarExtensions.get(config.name) ?? [];
    let specifiedByURL = config.specifiedByURL;
    for (const extensionNode of extensions) {
      specifiedByURL = getSpecifiedByURL(extensionNode) ?? specifiedByURL;
    }
    return new definition_js_1.GraphQLScalarType({
      ...config,
      specifiedByURL,
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }
  function extendObjectType(type) {
    const config = type.toConfig();
    const extensions = objectExtensions.get(config.name) ?? [];
    return new definition_js_1.GraphQLObjectType({
      ...config,
      interfaces: () => [
        ...type.getInterfaces().map(replaceNamedType),
        ...buildInterfaces(extensions),
      ],
      fields: () => ({
        ...(0, mapValue_js_1.mapValue)(config.fields, extendField),
        ...buildFieldMap(extensions),
      }),
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }
  function extendInterfaceType(type) {
    const config = type.toConfig();
    const extensions = interfaceExtensions.get(config.name) ?? [];
    return new definition_js_1.GraphQLInterfaceType({
      ...config,
      interfaces: () => [
        ...type.getInterfaces().map(replaceNamedType),
        ...buildInterfaces(extensions),
      ],
      fields: () => ({
        ...(0, mapValue_js_1.mapValue)(config.fields, extendField),
        ...buildFieldMap(extensions),
      }),
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }
  function extendUnionType(type) {
    const config = type.toConfig();
    const extensions = unionExtensions.get(config.name) ?? [];
    return new definition_js_1.GraphQLUnionType({
      ...config,
      types: () => [
        ...type.getTypes().map(replaceNamedType),
        ...buildUnionTypes(extensions),
      ],
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }
  function extendField(field) {
    return {
      ...field,
      type: replaceType(field.type),
      args: field.args && (0, mapValue_js_1.mapValue)(field.args, extendArg),
    };
  }
  function extendArg(arg) {
    return {
      ...arg,
      type: replaceType(arg.type),
    };
  }
  function getOperationTypes(nodes) {
    const opTypes = {};
    for (const node of nodes) {
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      const operationTypesNodes =
        /* c8 ignore next */ node.operationTypes ?? [];
      for (const operationType of operationTypesNodes) {
        // Note: While this could make early assertions to get the correctly
        // typed values below, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable results.
        // @ts-expect-error
        opTypes[operationType.operation] = getNamedType(operationType.type);
      }
    }
    return opTypes;
  }
  function getNamedType(node) {
    const name = node.name.value;
    const type = stdTypeMap.get(name) ?? typeMap.get(name);
    if (type === undefined) {
      throw new Error(`Unknown type: "${name}".`);
    }
    return type;
  }
  function getWrappedType(node) {
    if (node.kind === kinds_js_1.Kind.LIST_TYPE) {
      return new definition_js_1.GraphQLList(getWrappedType(node.type));
    }
    if (node.kind === kinds_js_1.Kind.NON_NULL_TYPE) {
      return new definition_js_1.GraphQLNonNull(getWrappedType(node.type));
    }
    return getNamedType(node);
  }
  function buildDirective(node) {
    return new directives_js_1.GraphQLDirective({
      name: node.name.value,
      description: node.description?.value,
      // @ts-expect-error
      locations: node.locations.map(({ value }) => value),
      isRepeatable: node.repeatable,
      args: buildArgumentMap(node.arguments),
      astNode: node,
    });
  }
  function buildFieldMap(nodes) {
    const fieldConfigMap = Object.create(null);
    for (const node of nodes) {
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      const nodeFields = /* c8 ignore next */ node.fields ?? [];
      for (const field of nodeFields) {
        fieldConfigMap[field.name.value] = {
          // Note: While this could make assertions to get the correctly typed
          // value, that would throw immediately while type system validation
          // with validateSchema() will produce more actionable results.
          type: getWrappedType(field.type),
          description: field.description?.value,
          args: buildArgumentMap(field.arguments),
          deprecationReason: getDeprecationReason(field),
          astNode: field,
        };
      }
    }
    return fieldConfigMap;
  }
  function buildArgumentMap(args) {
    // FIXME: https://github.com/graphql/graphql-js/issues/2203
    const argsNodes = /* c8 ignore next */ args ?? [];
    const argConfigMap = Object.create(null);
    for (const arg of argsNodes) {
      // Note: While this could make assertions to get the correctly typed
      // value, that would throw immediately while type system validation
      // with validateSchema() will produce more actionable results.
      const type = getWrappedType(arg.type);
      argConfigMap[arg.name.value] = {
        type,
        description: arg.description?.value,
        defaultValue: (0, valueFromAST_js_1.valueFromAST)(
          arg.defaultValue,
          type,
        ),
        deprecationReason: getDeprecationReason(arg),
        astNode: arg,
      };
    }
    return argConfigMap;
  }
  function buildInputFieldMap(nodes) {
    const inputFieldMap = Object.create(null);
    for (const node of nodes) {
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      const fieldsNodes = /* c8 ignore next */ node.fields ?? [];
      for (const field of fieldsNodes) {
        // Note: While this could make assertions to get the correctly typed
        // value, that would throw immediately while type system validation
        // with validateSchema() will produce more actionable results.
        const type = getWrappedType(field.type);
        inputFieldMap[field.name.value] = {
          type,
          description: field.description?.value,
          defaultValue: (0, valueFromAST_js_1.valueFromAST)(
            field.defaultValue,
            type,
          ),
          deprecationReason: getDeprecationReason(field),
          astNode: field,
        };
      }
    }
    return inputFieldMap;
  }
  function buildEnumValueMap(nodes) {
    const enumValueMap = Object.create(null);
    for (const node of nodes) {
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      const valuesNodes = /* c8 ignore next */ node.values ?? [];
      for (const value of valuesNodes) {
        enumValueMap[value.name.value] = {
          description: value.description?.value,
          deprecationReason: getDeprecationReason(value),
          astNode: value,
        };
      }
    }
    return enumValueMap;
  }
  function buildInterfaces(nodes) {
    // Note: While this could make assertions to get the correctly typed
    // values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    // @ts-expect-error
    return nodes.flatMap(
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      (node) => /* c8 ignore next */ node.interfaces?.map(getNamedType) ?? [],
    );
  }
  function buildUnionTypes(nodes) {
    // Note: While this could make assertions to get the correctly typed
    // values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    // @ts-expect-error
    return nodes.flatMap(
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      (node) => /* c8 ignore next */ node.types?.map(getNamedType) ?? [],
    );
  }
  function buildType(astNode) {
    const name = astNode.name.value;
    switch (astNode.kind) {
      case kinds_js_1.Kind.OBJECT_TYPE_DEFINITION: {
        const extensionASTNodes = objectExtensions.get(name) ?? [];
        const allNodes = [astNode, ...extensionASTNodes];
        return new definition_js_1.GraphQLObjectType({
          name,
          description: astNode.description?.value,
          interfaces: () => buildInterfaces(allNodes),
          fields: () => buildFieldMap(allNodes),
          astNode,
          extensionASTNodes,
        });
      }
      case kinds_js_1.Kind.INTERFACE_TYPE_DEFINITION: {
        const extensionASTNodes = interfaceExtensions.get(name) ?? [];
        const allNodes = [astNode, ...extensionASTNodes];
        return new definition_js_1.GraphQLInterfaceType({
          name,
          description: astNode.description?.value,
          interfaces: () => buildInterfaces(allNodes),
          fields: () => buildFieldMap(allNodes),
          astNode,
          extensionASTNodes,
        });
      }
      case kinds_js_1.Kind.ENUM_TYPE_DEFINITION: {
        const extensionASTNodes = enumExtensions.get(name) ?? [];
        const allNodes = [astNode, ...extensionASTNodes];
        return new definition_js_1.GraphQLEnumType({
          name,
          description: astNode.description?.value,
          values: buildEnumValueMap(allNodes),
          astNode,
          extensionASTNodes,
        });
      }
      case kinds_js_1.Kind.UNION_TYPE_DEFINITION: {
        const extensionASTNodes = unionExtensions.get(name) ?? [];
        const allNodes = [astNode, ...extensionASTNodes];
        return new definition_js_1.GraphQLUnionType({
          name,
          description: astNode.description?.value,
          types: () => buildUnionTypes(allNodes),
          astNode,
          extensionASTNodes,
        });
      }
      case kinds_js_1.Kind.SCALAR_TYPE_DEFINITION: {
        const extensionASTNodes = scalarExtensions.get(name) ?? [];
        return new definition_js_1.GraphQLScalarType({
          name,
          description: astNode.description?.value,
          specifiedByURL: getSpecifiedByURL(astNode),
          astNode,
          extensionASTNodes,
        });
      }
      case kinds_js_1.Kind.INPUT_OBJECT_TYPE_DEFINITION: {
        const extensionASTNodes = inputObjectExtensions.get(name) ?? [];
        const allNodes = [astNode, ...extensionASTNodes];
        return new definition_js_1.GraphQLInputObjectType({
          name,
          description: astNode.description?.value,
          fields: () => buildInputFieldMap(allNodes),
          astNode,
          extensionASTNodes,
          isOneOf: isOneOf(astNode),
        });
      }
    }
  }
}
exports.extendSchemaImpl = extendSchemaImpl;
const stdTypeMap = new Map(
  [
    ...scalars_js_1.specifiedScalarTypes,
    ...introspection_js_1.introspectionTypes,
  ].map((type) => [type.name, type]),
);
/**
 * Given a field or enum value node, returns the string value for the
 * deprecation reason.
 */
function getDeprecationReason(node) {
  const deprecated = (0, values_js_1.getDirectiveValues)(
    directives_js_1.GraphQLDeprecatedDirective,
    node,
  );
  // @ts-expect-error validated by `getDirectiveValues`
  return deprecated?.reason;
}
/**
 * Given a scalar node, returns the string value for the specifiedByURL.
 */
function getSpecifiedByURL(node) {
  const specifiedBy = (0, values_js_1.getDirectiveValues)(
    directives_js_1.GraphQLSpecifiedByDirective,
    node,
  );
  // @ts-expect-error validated by `getDirectiveValues`
  return specifiedBy?.url;
}
/**
 * Given an input object node, returns if the node should be OneOf.
 */
function isOneOf(node) {
  return Boolean(
    (0, values_js_1.getDirectiveValues)(
      directives_js_1.GraphQLOneOfDirective,
      node,
    ),
  );
}
